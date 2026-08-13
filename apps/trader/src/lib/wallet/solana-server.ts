import "server-only";
import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  unpackAccount,
} from "@solana/spl-token";
import { isValidDevnetConfig, TEST_USDC_DECIMALS } from "./domain";

const allowedTokenPrograms = new Set([TOKEN_PROGRAM_ID.toBase58(), TOKEN_2022_PROGRAM_ID.toBase58()]);

function config() {
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC;
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;
  const mintAddress = process.env.NEXT_PUBLIC_TEST_USDC_MINT;
  const programAddress = process.env.NEXT_PUBLIC_WHISTL_PROGRAM_ID;
  if (!isValidDevnetConfig(cluster, rpc) || !rpc || !mintAddress || !programAddress) throw new Error("DEVNET_WALLET_NOT_CONFIGURED");
  return { rpc, mint: new PublicKey(mintAddress), programId: new PublicKey(programAddress) };
}

export function devnetConnection(): Connection {
  return new Connection(config().rpc, "confirmed");
}

export function parseWalletAddress(address: string): PublicKey {
  try {
    return new PublicKey(address);
  } catch {
    throw new Error("INVALID_SOLANA_WALLET");
  }
}

async function mintProgram(connection: Connection, mint: PublicKey): Promise<PublicKey> {
  const account = await connection.getAccountInfo(mint, "confirmed");
  if (!account || !allowedTokenPrograms.has(account.owner.toBase58())) throw new Error("UNTRUSTED_TEST_USDC_MINT");
  return account.owner;
}

export async function readDevnetWallet(address: string) {
  const owner = parseWalletAddress(address);
  const { mint, programId } = config();
  const connection = devnetConnection();
  const tokenProgram = await mintProgram(connection, mint);
  const [mandate] = PublicKey.findProgramAddressSync(
    [Buffer.from("mandate"), owner.toBuffer(), mint.toBuffer()],
    programId,
  );
  const [mandateVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("mandate_vault"), mandate.toBuffer()],
    programId,
  );
  const [lamports, accounts, programAccount, mandateAccount, vaultAccount] = await Promise.all([
    connection.getBalance(owner, "confirmed"),
    connection.getTokenAccountsByOwner(owner, { mint }, "confirmed"),
    connection.getAccountInfo(programId, "confirmed"),
    connection.getAccountInfo(mandate, "confirmed"),
    connection.getAccountInfo(mandateVault, "confirmed"),
  ]);
  const rawAmount = accounts.value.reduce((sum, item) => {
    const account = unpackAccount(item.pubkey, item.account, tokenProgram);
    return sum + account.amount;
  }, BigInt(0));
  const allocatedAmount = vaultAccount
    ? unpackAccount(mandateVault, vaultAccount, tokenProgram).amount
    : BigInt(0);
  const escrowReady = Boolean(programAccount?.executable && tokenProgram.equals(TOKEN_PROGRAM_ID));

  return {
    address: owner.toBase58(),
    cluster: "devnet" as const,
    solBalance: lamports / 1_000_000_000,
    testUsdcBalance: Number(rawAmount) / 10 ** TEST_USDC_DECIMALS,
    testUsdcMint: mint.toBase58(),
    tokenProgram: tokenProgram.equals(TOKEN_2022_PROGRAM_ID) ? "token-2022" : "spl-token",
    escrowReady,
    allocatedBalance: Number(allocatedAmount) / 10 ** TEST_USDC_DECIMALS,
    mandateInitialized: Boolean(mandateAccount),
    mandateAddress: mandate.toBase58(),
    mandateVaultAddress: mandateVault.toBase58(),
    programId: programId.toBase58(),
  };
}

function mintAuthority(): Keypair {
  const encoded = process.env.MINT_AUTHORITY_SECRET_BASE58;
  if (!encoded) throw new Error("DEVNET_FAUCET_NOT_CONFIGURED");
  const secret = bs58.decode(encoded);
  if (secret.length !== 64) throw new Error("DEVNET_FAUCET_NOT_CONFIGURED");
  return Keypair.fromSecretKey(secret);
}

export async function mintTestUsdc(address: string, amount: number): Promise<{ signature: string; simulationUnits: number | null }> {
  const owner = parseWalletAddress(address);
  const { mint } = config();
  const connection = devnetConnection();
  const authority = mintAuthority();
  const tokenProgram = await mintProgram(connection, mint);
  const mintState = await getMint(connection, mint, "confirmed", tokenProgram);
  if (mintState.decimals !== TEST_USDC_DECIMALS || !mintState.mintAuthority?.equals(authority.publicKey)) {
    throw new Error("DEVNET_FAUCET_AUTHORITY_MISMATCH");
  }

  const ata = await getAssociatedTokenAddress(mint, owner, false, tokenProgram);
  const transaction = new Transaction();
  const ataInfo = await connection.getAccountInfo(ata, "confirmed");
  if (!ataInfo) {
    transaction.add(createAssociatedTokenAccountInstruction(authority.publicKey, ata, owner, mint, tokenProgram));
  } else if (!ataInfo.owner.equals(tokenProgram)) {
    throw new Error("UNTRUSTED_TOKEN_ACCOUNT");
  }

  const rawAmount = BigInt(Math.round(amount * 10 ** TEST_USDC_DECIMALS));
  transaction.add(createMintToInstruction(mint, ata, authority.publicKey, rawAmount, [], tokenProgram));
  const latest = await connection.getLatestBlockhash("confirmed");
  transaction.feePayer = authority.publicKey;
  transaction.recentBlockhash = latest.blockhash;
  transaction.sign(authority);

  const simulation = await connection.simulateTransaction(transaction);
  if (simulation.value.err) throw new Error("DEVNET_FAUCET_SIMULATION_FAILED");

  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 3,
  });
  const confirmation = await connection.confirmTransaction({ signature, ...latest }, "confirmed");
  if (confirmation.value.err) throw new Error("DEVNET_FAUCET_CONFIRMATION_FAILED");
  return { signature, simulationUnits: simulation.value.unitsConsumed ?? null };
}
