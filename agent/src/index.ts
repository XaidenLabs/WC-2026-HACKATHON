import { WhistlAgent } from "./agent";

// Bootstrap the OOBE Protocol Agent
const agent = new WhistlAgent();

console.log("==========================================");
console.log(" WHISTL Protocol | OOBE Agent Node ");
console.log(" Powered by Synapse & AceDataCloud");
console.log("==========================================");

agent.start();

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down agent...");
  process.exit();
});
