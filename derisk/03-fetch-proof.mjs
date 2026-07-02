// De-risk step 3: fetch a real stat-validation Merkle proof and dump its raw shape,
// so step 4 can map it onto the on-chain validate_stat args exactly.
// Usage: node 03-fetch-proof.mjs [fixtureId] [seq] [statKey] [statKey2]
// Defaults to the docs' on-chain-validation example.
import "./lib/loadenv.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guestStart, statValidation } from "./lib/txline.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const apiToken = process.env.TXLINE_API_TOKEN;
if (!apiToken) {
  console.error("No TXLINE_API_TOKEN in .env — run activate.mjs first.");
  process.exit(1);
}

const fixtureId = Number(process.argv[2] ?? 17952170);
const seq = Number(process.argv[3] ?? 941);
const statKey = Number(process.argv[4] ?? 1002);
const statKey2 = process.argv[5] ? Number(process.argv[5]) : undefined;

const jwt = await guestStart();
const auth = { sessionJwt: jwt, apiToken };

console.log(`→ stat-validation fixtureId=${fixtureId} seq=${seq} statKey=${statKey}${statKey2 ? ` statKey2=${statKey2}` : ""}`);
try {
  const proof = await statValidation(auth, { fixtureId, seq, statKey, statKey2 });
  const json = JSON.stringify(proof, null, 2);
  console.log(json.length > 5000 ? json.slice(0, 5000) + "\n…(truncated)" : json);
  fs.writeFileSync(path.join(__dirname, "proof.json"), json);
  console.log("\n✅ saved proof.json");
} catch (e) {
  console.error("❌ stat-validation failed:", e.message);
  process.exit(1);
}
