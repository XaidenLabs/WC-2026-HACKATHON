// Diagnostic: which daily_scores_roots PDAs actually exist on devnet?
// Confirms the seed scheme and shows which epochDays have published roots.
import "./lib/loadenv.mjs";
import anchor from "@coral-xyz/anchor";
import { TXLINE_PROGRAM_ID_DEVNET } from "./lib/txline.mjs";

const { Connection, PublicKey } = anchor.web3;
const connection = new Connection(process.env.DEVNET_RPC_URL || "https://api.devnet.solana.com", "confirmed");
const programId = new PublicKey(TXLINE_PROGRAM_ID_DEVNET);

const start = 20590;
const end = 20645;
const found = [];
for (let d = start; d <= end; d++) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(d);
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("daily_scores_roots"), buf], programId);
  const info = await connection.getAccountInfo(pda);
  if (info) found.push({ d, pda: pda.toBase58(), len: info.data.length });
}
console.log(`Scanned epochDays ${start}..${end} — daily_scores_roots found: ${found.length}`);
for (const f of found) console.log(`  epochDay ${f.d} -> ${f.pda} (${f.len} bytes)`);
if (found.length === 0) {
  console.log("None found — seed/encoding likely wrong, or roots stored under a different scheme.");
}
