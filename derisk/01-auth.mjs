// De-risk step 1: prove we can reach TxLINE and get a guest session.
// Zero dependencies. Run:  node 01-auth.mjs
import { guestStart, TXLINE_API_BASE } from "./lib/txline.mjs";

console.log(`→ POST ${TXLINE_API_BASE}/auth/guest/start`);
const jwt = await guestStart();
console.log("✅ Guest session acquired.");
console.log("   JWT (truncated):", jwt.slice(0, 32) + "…");
console.log("");
console.log("Next: this JWT alone cannot read scores/odds data.");
console.log("Run 02-subscribe-activate.mjs to get an X-Api-Token (free World Cup tier).");
