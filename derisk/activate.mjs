// Activate the subscription -> X-Api-Token, reusing an EXISTING subscribe tx (no re-subscribe).
// Per docs: walletSignature = detached signature (BASE64) over a message binding
//   txSig + comma-separated leagues + JWT. Response is PLAIN TEXT (e.g. "txoracle_api_...").
// The exact delimiter isn't documented, so we try the plausible ones. Retries 5xx (endpoint 504s).
// Run:  node activate.mjs <subscribeTxSig>   (or set SUBSCRIBE_TX_SIG in .env)
import "./lib/loadenv.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import anchor from "@coral-xyz/anchor";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { guestStart, TXLINE_API_BASE } from "./lib/txline.mjs";

const { Keypair } = anchor.web3;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, ".env");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function appendEnv(key, val) {
  let cur = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const line = `${key}=${val}`;
  if (new RegExp(`^${key}=`, "m").test(cur)) cur = cur.replace(new RegExp(`^${key}=.*$`, "m"), line);
  else cur += (cur === "" || cur.endsWith("\n") ? "" : "\n") + line + "\n";
  fs.writeFileSync(ENV_PATH, cur);
}

const txSig = process.argv[2] || process.env.SUBSCRIBE_TX_SIG;
if (!txSig) {
  console.error("Provide the subscribe tx signature: node activate.mjs <txSig>  (or set SUBSCRIBE_TX_SIG)");
  process.exit(1);
}
appendEnv("SUBSCRIBE_TX_SIG", txSig);

const kp = Keypair.fromSecretKey(bs58.decode(process.env.DEVNET_KEYPAIR_BASE58));
const jwt = await guestStart();
console.log("✅ guest jwt acquired");

const leagues = []; // [] = World Cup bundle
const L = leagues.join(",");

// Candidate message bindings (doc: txSig + comma-separated leagues + JWT; delimiter unspecified).
const candidates = [
  `${txSig}::${jwt}`, // CONFIRMED by TxODDS support: free tier (empty leagues) signs txSig::jwt
  [txSig, L, jwt].join("::"), // general form: txSig::leagues::jwt
  `${txSig}::${L}::${jwt}`,
  [txSig, jwt].join(","),
];

const signB64 = (msg) =>
  Buffer.from(nacl.sign.detached(new TextEncoder().encode(msg), kp.secretKey)).toString("base64");

async function post(walletSignature) {
  const res = await fetch(`${TXLINE_API_BASE}/api/token/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ txSig, walletSignature, leagues }),
  });
  return { status: res.status, ok: res.ok, text: await res.text() };
}

let token = null;
let sawServerDown = false;
outer: for (let attempt = 1; attempt <= 4 && !token; attempt++) {
  for (let ci = 0; ci < candidates.length; ci++) {
    let r;
    try {
      r = await post(signB64(candidates[ci]));
    } catch (e) {
      console.log("  network error:", e.message);
      await sleep(2500);
      continue;
    }
    if (r.status >= 500) {
      // Endpoint is down server-side; no candidate will work right now.
      sawServerDown = true;
      console.log(`  attempt ${attempt}: ${r.status} (TxODDS endpoint down) — backing off`);
      await sleep(5000);
      break; // retry the whole set after backoff
    }
    if (r.ok) {
      const t = r.text.trim().replace(/^"|"$/g, "");
      if (t && !t.startsWith("<")) {
        token = t;
        console.log(`✅ accepted with message format #${ci}`);
        break outer;
      }
    }
    console.log(`  msg#${ci}: ${r.status} ${r.text.slice(0, 100).replace(/\s+/g, " ")}`);
  }
}

if (!token) {
  if (sawServerDown) {
    console.error("\n❌ The TxODDS /api/token/activate endpoint is returning 5xx (server-side outage).");
    console.error("   Our request is correct; just re-run when their endpoint recovers, or ask in the");
    console.error("   hackathon Discord/Telegram whether activation is down.");
  } else {
    console.error("\n❌ All message formats were rejected (4xx). The signing-message format differs from the doc's description.");
  }
  process.exit(1);
}

appendEnv("TXLINE_API_TOKEN", token);
console.log("✅ X-Api-Token acquired & saved to .env:", token.slice(0, 16) + "…");
console.log("Next: node 03-fetch-proof.mjs");
