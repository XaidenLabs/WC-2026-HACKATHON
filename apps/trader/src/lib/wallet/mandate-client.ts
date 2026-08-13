"use client";

import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { TEST_USDC_DECIMALS } from "./domain";

const INITIALIZE_MANDATE = Uint8Array.from([7, 251, 124, 114, 46, 104, 193, 22]);
const DEPOSIT_MANDATE = Uint8Array.from([214, 84, 100, 102, 85, 79, 251, 23]);
const WITHDRAW_MANDATE = Uint8Array.from([84, 228, 87, 247, 217, 41, 243, 15]);
const FALLBACK_PROGRAM_ID = "9xe1gCVh7kNqjfRbidVUpWBcS2A4EstvkBMkxc34LWRR";

function configuration() {
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC;
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;
  const mint = process.env.NEXT_PUBLIC_TEST_USDC_MINT;
  const executor = process.env.NEXT_PUBLIC_ORA_PUBKEY;
  const programId = process.env.NEXT_PUBLIC_WHISTL_PROGRAM_ID ?? FALLBACK_PROGRAM_ID;
  if (!rpc || cluster !== "devnet" || !mint || !executor) throw new Error("DEVNET_MANDATE_NOT_CONFIGURED");
  return {
    rpc,
    mint: new PublicKey(mint),
    executor: new PublicKey(executor),
    programId: new PublicKey(programId),
  };
}

function u64(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  let remaining = value;
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number(remaining % BigInt(256));
    remaining /= BigInt(256);
  }
  return bytes;
}

function i32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setInt32(0, value, true);
  return bytes;
}

function u16(value: number): Uint8Array {
  return Uint8Array.from([value & 255, (value >> 8) & 255]);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export function mandateAddresses(user: PublicKey, mint: PublicKey, programId: PublicKey) {
  const [mandate] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("mandate"), user.toBytes(), mint.toBytes()],
    programId,
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("mandate_vault"), mandate.toBytes()],
    programId,
  );
  return { mandate, vault };
}

function initializeInstruction(user: PublicKey) {
  const { mint, executor, programId } = configuration();
  const { mandate, vault } = mandateAddresses(user, mint, programId);
  const data = concat(
    INITIALIZE_MANDATE,
    executor.toBytes(),
    Uint8Array.from([0]),
    u64(BigInt(100) * BigInt(10) ** BigInt(TEST_USDC_DECIMALS)),
    u64(BigInt(500) * BigInt(10) ** BigInt(TEST_USDC_DECIMALS)),
    i32(400),
    u16(200),
  );
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: mandate, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

function movementInstruction(action: "allocate" | "withdraw", user: PublicKey, amount: bigint) {
  const { mint, programId } = configuration();
  const { mandate, vault } = mandateAddresses(user, mint, programId);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: mandate, isSigner: false, isWritable: false },
      { pubkey: getAssociatedTokenAddressSync(mint, user), isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(concat(action === "allocate" ? DEPOSIT_MANDATE : WITHDRAW_MANDATE, u64(amount))),
  });
}

export function useMandateActions() {
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const wallet = wallets.find((item) => (item.standardWallet as { isPrivyWallet?: boolean })?.isPrivyWallet) ?? wallets[0];

  async function move(action: "allocate" | "withdraw", amount: number): Promise<{ signature: string; simulationUnits: number | null }> {
    if (!wallet) throw new Error("WALLET_NOT_CONNECTED");
    const { rpc, mint, programId } = configuration();
    const connection = new Connection(rpc, "confirmed");
    const user = new PublicKey(wallet.address);
    const { mandate } = mandateAddresses(user, mint, programId);
    const [programAccount, mandateAccount] = await Promise.all([
      connection.getAccountInfo(programId, "confirmed"),
      connection.getAccountInfo(mandate, "confirmed"),
    ]);
    if (!programAccount?.executable) throw new Error("ESCROW_PROGRAM_NOT_DEPLOYED");

    const rawAmount = BigInt(Math.round(amount * 10 ** TEST_USDC_DECIMALS));
    const transaction = new Transaction();
    if (!mandateAccount) {
      if (action === "withdraw") throw new Error("NO_ORA_ALLOCATION");
      transaction.add(initializeInstruction(user));
    }
    transaction.add(
      createAssociatedTokenAccountIdempotentInstruction(
        user,
        getAssociatedTokenAddressSync(mint, user),
        user,
        mint,
      ),
      movementInstruction(action, user, rawAmount),
    );

    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.feePayer = user;
    transaction.recentBlockhash = latest.blockhash;
    const simulation = await connection.simulateTransaction(transaction);
    if (simulation.value.err) {
      console.error("[wallet] mandate simulation failed", simulation.value.err, simulation.value.logs);
      throw new Error("MANDATE_SIMULATION_FAILED");
    }

    const { signedTransaction } = await signTransaction({
      transaction: transaction.serialize({ requireAllSignatures: false }),
      wallet,
      chain: "solana:devnet",
    });
    const signature = await connection.sendRawTransaction(signedTransaction, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });
    const confirmation = await connection.confirmTransaction({ signature, ...latest }, "confirmed");
    if (confirmation.value.err) throw new Error("MANDATE_CONFIRMATION_FAILED");
    return { signature, simulationUnits: simulation.value.unitsConsumed ?? null };
  }

  return { wallet, allocate: (amount: number) => move("allocate", amount), withdraw: (amount: number) => move("withdraw", amount) };
}
