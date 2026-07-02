// De-risk step 4 (THE BIG ONE): prove TxLINE's on-chain validate_stat returns the correct
// verdict for a real Merkle proof. If TRUE-predicate -> true and FALSE-predicate -> false,
// the entire trustless-settlement thesis is proven on devnet.
// Run:  node 04-validate-onchain.mjs   (after 03-fetch-proof.mjs writes proof.json)
import "./lib/loadenv.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import anchor from "@coral-xyz/anchor";
import bs58 from "bs58";
import { TXLINE_PROGRAM_ID_DEVNET } from "./lib/txline.mjs";

const { Connection, Keypair, PublicKey, ComputeBudgetProgram } = anchor.web3;
const BN = anchor.BN;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const proof = JSON.parse(fs.readFileSync(path.join(__dirname, "proof.json"), "utf8"));

const rpc = process.env.DEVNET_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(rpc, "confirmed");
// Use the funded devnet wallet as fee payer (an unfunded payer makes simulate return AccountNotFound).
const payer = process.env.DEVNET_KEYPAIR_BASE58
  ? Keypair.fromSecretKey(bs58.decode(process.env.DEVNET_KEYPAIR_BASE58))
  : Keypair.generate();
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(payer), {
  commitment: "confirmed",
});
const programId = new PublicKey(TXLINE_PROGRAM_ID_DEVNET);
const program = await anchor.Program.at(programId, provider);

// daily_scores_roots PDA = ["daily_scores_roots", u16_le(epochDay)], epochDay = floor(ts_ms / 86400000)
const epochDay = Math.floor(proof.ts / 86_400_000);
const epochBuf = Buffer.alloc(2);
epochBuf.writeUInt16LE(epochDay);
const [dailyScoresMerkleRoots] = PublicKey.findProgramAddressSync(
  [Buffer.from("daily_scores_roots"), epochBuf],
  programId,
);
console.log("epochDay:", epochDay, "| daily_scores_roots PDA:", dailyScoresMerkleRoots.toBase58());

const node = (n) => ({ hash: n.hash, isRightSibling: n.isRightSibling });
const fixtureSummary = {
  fixtureId: new BN(proof.summary.fixtureId),
  updateStats: {
    updateCount: proof.summary.updateStats.updateCount,
    minTimestamp: new BN(proof.summary.updateStats.minTimestamp),
    maxTimestamp: new BN(proof.summary.updateStats.maxTimestamp),
  },
  eventsSubTreeRoot: proof.summary.eventStatsSubTreeRoot,
};
const fixtureProof = proof.subTreeProof.map(node);
const mainTreeProof = proof.mainTreeProof.map(node);
const statA = {
  statToProve: {
    key: proof.statToProve.key,
    value: proof.statToProve.value,
    period: proof.statToProve.period,
  },
  eventStatRoot: proof.eventStatRoot,
  statProof: proof.statProof.map(node),
};
const cb = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

function pdaForTs(tsVal) {
  const d = Math.floor(tsVal / 86_400_000);
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(d);
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("daily_scores_roots"), buf], programId);
  return { day: d, pda };
}

async function sim(tsVal, pda, predicate) {
  const ix = await program.methods
    .validateStat(new BN(tsVal), fixtureSummary, fixtureProof, mainTreeProof, predicate, statA, null, null)
    .accounts({ dailyScoresMerkleRoots: pda })
    .instruction();
  const { blockhash } = await connection.getLatestBlockhash();
  const msg = new anchor.web3.TransactionMessage({
    payerKey: provider.wallet.publicKey,
    recentBlockhash: blockhash,
    instructions: [cb, ix],
  }).compileToV0Message();
  const r = await connection.simulateTransaction(new anchor.web3.VersionedTransaction(msg), {
    sigVerify: false,
    replaceRecentBlockhash: true,
  });
  return r.value;
}

const readBool = (val) =>
  val.returnData?.data ? Buffer.from(val.returnData.data[0], "base64")[0] !== 0 : null;

const v = proof.statToProve.value;
const truePred = { threshold: v, comparison: { equalTo: {} } };
const falsePred = { threshold: v + 1000, comparison: { greaterThan: {} } };

console.log(`\nProven stat: key=${proof.statToProve.key} value=${v} period=${proof.statToProve.period}\n`);

// The program checks `ts` against the snapshot timestamp — find which one it accepts.
const tsCandidates = [
  ["summary.maxTimestamp", proof.summary.updateStats.maxTimestamp],
  ["summary.minTimestamp", proof.summary.updateStats.minTimestamp],
  ["proof.ts", proof.ts],
];

let chosen = null;
for (const [name, t] of tsCandidates) {
  const { day, pda } = pdaForTs(t);
  const r = await sim(t, pda, truePred);
  if (r.err) {
    const code = r.err?.InstructionError?.[1]?.Custom;
    console.log(`ts=${name} (${t}, day ${day}) -> err ${code ?? JSON.stringify(r.err)}`);
    continue;
  }
  console.log(`ts=${name} (${t}, day ${day}) -> OK, verdict=${readBool(r)}`);
  chosen = { name, t, pda };
  break;
}

if (!chosen) {
  console.log("\n⚠️ No ts candidate passed the program's early checks.");
  process.exit(1);
}

async function verdict(label, predicate) {
  const r = await sim(chosen.t, chosen.pda, predicate);
  if (r.err) {
    console.error(`${label} -> err ${JSON.stringify(r.err)}`);
    return null;
  }
  const b = readBool(r);
  console.log(`${label} -> ${b}`);
  return b;
}

console.log(`\nUsing ts=${chosen.name}:\n`);
const t1 = await verdict(`predicate (value == ${v})       [expect TRUE] `, truePred);
const f1 = await verdict(`predicate (value > ${v + 1000})  [expect FALSE]`, falsePred);

console.log("");
if (t1 === true && f1 === false) {
  console.log("✅✅ SETTLEMENT CORE PROVEN: validate_stat verifies the real Merkle proof AND");
  console.log("     evaluates the predicate correctly on devnet. The trustless payout logic works.");
} else {
  console.log("⚠️ Unexpected verdicts — see above.");
}
