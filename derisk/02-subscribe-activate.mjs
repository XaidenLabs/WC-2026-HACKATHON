// De-risk step 2: get an X-Api-Token via the FREE World Cup tier (subscribe + activate).
// Node only — uses a throwaway devnet wallet (free SOL). Run:  node 02-subscribe-activate.mjs
// Re-runnable: reuses the saved keypair; writes results back into .env.
import "./lib/loadenv.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import anchor from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import nacl from "tweetnacl";
import {
  guestStart,
  TXLINE_API_BASE,
  TXLINE_PROGRAM_ID_DEVNET,
  TXL_MINT_DEVNET,
} from "./lib/txline.mjs";

const { Connection, Keypair, PublicKey, SystemProgram } = anchor.web3;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, ".env");

const SERVICE_LEVEL_ID = 1; // free WC, 60s delay (12 = real-time, also free)
const DURATION_WEEKS = 4;
const SELECTED_LEAGUES = []; // [] = standard World Cup bundle

function appendEnv(key, val) {
  let cur = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const line = `${key}=${val}`;
  if (new RegExp(`^${key}=`, "m").test(cur)) {
    cur = cur.replace(new RegExp(`^${key}=.*$`, "m"), line);
  } else {
    cur += (cur === "" || cur.endsWith("\n") ? "" : "\n") + line + "\n";
  }
  fs.writeFileSync(ENV_PATH, cur);
}

function loadOrCreateKeypair() {
  const b58 = process.env.DEVNET_KEYPAIR_BASE58;
  if (b58) return Keypair.fromSecretKey(bs58.decode(b58));
  const kp = Keypair.generate();
  appendEnv("DEVNET_KEYPAIR_BASE58", bs58.encode(kp.secretKey));
  console.log("🆕 Generated a throwaway DEVNET keypair (saved to .env).");
  return kp;
}

const rpc = process.env.DEVNET_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(rpc, "confirmed");
const kp = loadOrCreateKeypair();
const wallet = new anchor.Wallet(kp);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
const programId = new PublicKey(TXLINE_PROGRAM_ID_DEVNET);
const txlMint = new PublicKey(TXL_MINT_DEVNET);

console.log("Wallet:", kp.publicKey.toBase58());

// --- ensure some SOL for fees ---
let bal = await connection.getBalance(kp.publicKey);
console.log("SOL balance:", bal / 1e9);
if (bal < 0.05 * 1e9) {
  try {
    console.log("→ requesting devnet airdrop (1 SOL)…");
    const sig = await connection.requestAirdrop(kp.publicKey, 1e9);
    await connection.confirmTransaction(sig, "confirmed");
    console.log("SOL balance:", (await connection.getBalance(kp.publicKey)) / 1e9);
  } catch {
    console.error("⚠️ Airdrop failed (public devnet faucet is rate-limited).");
    console.error(`   Fund this address with devnet SOL, then re-run:\n   ${kp.publicKey.toBase58()}`);
    console.error("   Faucet: https://faucet.solana.com  (paste address, choose Devnet)");
    process.exit(1);
  }
}

// --- guest jwt ---
const jwt = await guestStart();
console.log("✅ guest jwt acquired");

// --- program + derived accounts ---
const program = await anchor.Program.at(programId, provider);

const [pricingMatrix] = PublicKey.findProgramAddressSync([Buffer.from("pricing_matrix")], programId);
const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("token_treasury_v2")], programId);
// Best guess: treasury vault is the Token-2022 ATA of the treasury PDA for the TxL mint.
const tokenTreasuryVault = getAssociatedTokenAddressSync(txlMint, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID);
const userTokenAccount = getAssociatedTokenAddressSync(txlMint, kp.publicKey, false, TOKEN_2022_PROGRAM_ID);

console.log("pricingMatrix:     ", pricingMatrix.toBase58());
console.log("tokenTreasuryPda:  ", tokenTreasuryPda.toBase58());
console.log("tokenTreasuryVault:", tokenTreasuryVault.toBase58());
console.log("userTokenAccount:  ", userTokenAccount.toBase58());

// Ensure the user's TxL ATA exists (free tier needs 0 balance, but the account must exist).
try {
  await getOrCreateAssociatedTokenAccount(
    connection, kp, txlMint, kp.publicKey, false, "confirmed", undefined,
    TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  console.log("✅ user TxL ATA ready");
} catch (e) {
  console.error("⚠️ could not create user ATA (continuing anyway):", e.message);
}

// --- subscribe (free WC tier) ---
let txSig;
try {
  txSig = await program.methods
    .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
    .accounts({
      user: kp.publicKey,
      pricingMatrix,
      tokenMint: txlMint,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc();
  console.log("✅ subscribe tx:", txSig);
} catch (e) {
  console.error("❌ subscribe failed:", e.message ?? e);
  if (e.logs) console.error("--- program logs ---\n" + e.logs.join("\n"));
  process.exit(1);
}

// --- activate -> X-Api-Token ---
// walletSignature: detached signature over the tx signature bytes (first guess — iterate if rejected).
const walletSignature = bs58.encode(nacl.sign.detached(Buffer.from(txSig), kp.secretKey));
const res = await fetch(`${TXLINE_API_BASE}/api/token/activate`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
  body: JSON.stringify({ txSig, walletSignature, leagues: SELECTED_LEAGUES }),
});
if (!res.ok) {
  console.error("❌ activate failed:", res.status, await res.text());
  process.exit(1);
}
const data = await res.json();
const apiToken = typeof data === "string" ? data : data.token || data.apiToken;
if (!apiToken) {
  console.error("❌ activate returned no token:", JSON.stringify(data));
  process.exit(1);
}
appendEnv("TXLINE_API_TOKEN", apiToken);
console.log("✅ X-Api-Token acquired & saved to .env:", String(apiToken).slice(0, 24) + "…");
console.log("Next: node 03-fetch-proof.mjs");
