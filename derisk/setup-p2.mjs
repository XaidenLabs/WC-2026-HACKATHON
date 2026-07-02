// P2 setup: create a devnet test-USDC mint + ORA's counterparty wallet (funded with SOL + test-USDC).
// Idempotent — reuses values already saved in .env. Run: node setup-p2.mjs
import "./lib/loadenv.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import anchor from "@coral-xyz/anchor";
import bs58 from "bs58";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

const { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } =
  anchor.web3;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, ".env");
function appendEnv(key, val) {
  let cur = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const line = `${key}=${val}`;
  if (new RegExp(`^${key}=`, "m").test(cur)) cur = cur.replace(new RegExp(`^${key}=.*$`, "m"), line);
  else cur += (cur === "" || cur.endsWith("\n") ? "" : "\n") + line + "\n";
  fs.writeFileSync(ENV_PATH, cur);
}

const rpc = process.env.DEVNET_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(rpc, "confirmed");
const payer = Keypair.fromSecretKey(bs58.decode(process.env.DEVNET_KEYPAIR_BASE58));
console.log("payer:", payer.publicKey.toBase58(), "| SOL:", (await connection.getBalance(payer.publicKey)) / 1e9);

// 1) test-USDC mint (6 decimals, payer is mint authority -> we can faucet freely)
let mint;
if (process.env.TEST_USDC_MINT) {
  mint = new PublicKey(process.env.TEST_USDC_MINT);
  console.log("reusing TEST_USDC_MINT:", mint.toBase58());
} else {
  mint = await createMint(connection, payer, payer.publicKey, null, 6);
  appendEnv("TEST_USDC_MINT", mint.toBase58());
  console.log("✅ created test-USDC mint:", mint.toBase58());
}

// 2) ORA wallet
let ora;
if (process.env.ORA_SECRET_BASE58) {
  ora = Keypair.fromSecretKey(bs58.decode(process.env.ORA_SECRET_BASE58));
  console.log("reusing ORA wallet:", ora.publicKey.toBase58());
} else {
  ora = Keypair.generate();
  appendEnv("ORA_SECRET_BASE58", bs58.encode(ora.secretKey));
  appendEnv("ORA_PUBKEY", ora.publicKey.toBase58());
  console.log("🆕 ORA wallet:", ora.publicKey.toBase58());
}

// fund ORA with a little SOL for tx fees + ATA rent
if ((await connection.getBalance(ora.publicKey)) < 0.15 * LAMPORTS_PER_SOL) {
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: ora.publicKey, lamports: 0.2 * LAMPORTS_PER_SOL }),
  );
  await sendAndConfirmTransaction(connection, tx, [payer]);
  console.log("funded ORA with 0.2 SOL");
}

// 3) ORA's USDC ATA + mint it test-USDC so it can stake as counterparty
const oraAta = await getOrCreateAssociatedTokenAccount(connection, payer, mint, ora.publicKey);
await mintTo(connection, payer, mint, oraAta.address, payer, 100_000 * 1_000_000); // 100k test-USDC
console.log("✅ ORA test-USDC ATA:", oraAta.address.toBase58(), "(+100,000 test-USDC)");

console.log("\n— P2 foundation ready —");
console.log("TEST_USDC_MINT =", mint.toBase58());
console.log("ORA_PUBKEY     =", ora.publicKey.toBase58());
console.log("(both saved to derisk/.env)");
