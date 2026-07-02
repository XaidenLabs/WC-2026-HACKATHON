// De-risk step 0: pull the REAL on-chain IDL so we stop guessing arg/account shapes.
// Read-only. No wallet funding needed. Run:  node 00-inspect-idl.mjs
import "./lib/loadenv.mjs";
import anchor from "@coral-xyz/anchor";
import { TXLINE_PROGRAM_ID_DEVNET } from "./lib/txline.mjs";

const { Connection, Keypair, PublicKey } = anchor.web3;

const rpc = process.env.DEVNET_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(rpc, "confirmed");
const wallet = new anchor.Wallet(Keypair.generate()); // throwaway; only needed to build a provider
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });

console.log(`→ Fetching IDL for ${TXLINE_PROGRAM_ID_DEVNET} from ${rpc}`);
const program = await anchor.Program.at(new PublicKey(TXLINE_PROGRAM_ID_DEVNET), provider);
const idl = program.idl;

console.log("\n=== PROGRAM ===");
console.log("name:   ", idl.metadata?.name ?? idl.name);
console.log("version:", idl.metadata?.version ?? idl.version);
console.log("address:", idl.address ?? "(n/a)");

const want = new Set([
  "createIntent", "closeIntent", "createTrade", "executeMatch",
  "settleTrade", "settleMatchedTrade", "claimViaResolution", "auditTradeResult",
  "validateStat",
]);
console.log("\n=== INSTRUCTIONS (all names) ===");
console.log(idl.instructions.map((i) => i.name).join(", "));

for (const ix of idl.instructions.filter((i) => want.has(i.name))) {
  console.log(`\n--- instruction: ${ix.name} ---`);
  console.log("accounts:");
  for (const a of ix.accounts) {
    const pda = a.pda ? `  PDA seeds=${JSON.stringify(a.pda.seeds)}` : "";
    console.log(`  - ${a.name}${a.signer ? " (signer)" : ""}${a.writable ? " (writable)" : ""}${pda}`);
  }
  console.log("args:", JSON.stringify(ix.args, null, 2));
  if (ix.returns) console.log("returns:", JSON.stringify(ix.returns));
}

if (process.env.DUMP_TYPES) {
  console.log("\n=== TYPES ===");
  for (const t of idl.types ?? []) {
    console.log(`\n--- type: ${t.name} ---`);
    console.log(JSON.stringify(t.type, null, 2));
  }
}
