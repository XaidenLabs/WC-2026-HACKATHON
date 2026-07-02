// Fund the throwaway devnet wallet with SOL (retries the flaky public faucet).
import "./lib/loadenv.mjs";
import anchor from "@coral-xyz/anchor";
import bs58 from "bs58";

const { Connection, Keypair } = anchor.web3;
const rpc = process.env.DEVNET_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(rpc, "confirmed");
const kp = Keypair.fromSecretKey(bs58.decode(process.env.DEVNET_KEYPAIR_BASE58));

console.log("Funding", kp.publicKey.toBase58(), "via", rpc);
let bal = await connection.getBalance(kp.publicKey);
console.log("balance:", bal / 1e9, "SOL");

for (let i = 1; i <= 6 && bal < 0.2e9; i++) {
  try {
    console.log(`→ airdrop attempt ${i} (1 SOL)…`);
    const sig = await connection.requestAirdrop(kp.publicKey, 1e9);
    await connection.confirmTransaction(sig, "confirmed");
  } catch (e) {
    console.log("  failed:", e.message);
  }
  bal = await connection.getBalance(kp.publicKey);
  console.log("  balance:", bal / 1e9, "SOL");
  if (bal < 0.2e9 && i < 6) await new Promise((r) => setTimeout(r, 4000));
}

if (bal < 0.05e9) {
  console.error("\n❌ Still unfunded. Paste this address into https://faucet.solana.com (choose Devnet):");
  console.error("   " + kp.publicKey.toBase58());
  process.exit(1);
}
console.log("✅ funded:", bal / 1e9, "SOL");
