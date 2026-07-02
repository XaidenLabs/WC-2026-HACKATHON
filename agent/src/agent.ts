import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { TxOddsStream } from "./txodds";
import { SolanaManager } from "./solana";
import { AceDataCloud } from "./acedatacloud";

export class WhistlAgent {
  private txodds: TxOddsStream;
  private solana: SolanaManager;
  private aceData: AceDataCloud;
  private llm: ChatOpenAI;

  constructor() {
    this.txodds = new TxOddsStream();
    this.solana = new SolanaManager();
    this.aceData = new AceDataCloud();
    
    this.llm = new ChatOpenAI({
      modelName: "gpt-4o-mini", // Cost-effective LangGraph reasoning
      temperature: 0,
    });
  }

  start() {
    console.log("[WhistlAgent] OOBE Synapse Engine Initialized. Agent is online.");
    
    // Connect to the real-time SSE stream
    this.txodds.connect();

    this.txodds.on("match_update", async (data) => {
      // For every match update, the agent processes the event
      await this.processMatchEvent(data);
    });
  }

  private async processMatchEvent(data: any) {
    console.log(`[WhistlAgent] Evaluating match data for fixture ${data.fixtureId}...`);

    const prompt = `
      You are the WHISTL Autonomous Settlement Agent.
      You just received TxODDS data for fixture ${data.fixtureId}.
      Data payload: ${JSON.stringify(data)}

      Based on the Merkle roots and the proofs provided, decide if this match is complete and if we should trigger the settle_pact transaction on Solana.
      Respond in JSON with { "shouldSettle": boolean, "reason": "string", "pactPda": "string" }
    `;

    try {
      // In a full LangGraph, this would be a node in the state machine.
      // Here we simulate the LLM's decision process.
      const response = await this.llm.invoke([
        new SystemMessage("You are a deterministic blockchain settlement agent."),
        new HumanMessage(prompt)
      ]);

      // Mock parsing for hackathon purposes
      const thought = response.content.toString();
      console.log(`[WhistlAgent] LLM Reasoning: ${thought}`);
      
      // Log the thought process to decentralized storage
      await this.aceData.logEvent("MATCH_EVALUATION", thought, data);

      // Execute on Solana if the agent decides it's valid
      // Note: In production, the LLM parses the JSON. Here we mock execution logic.
      if (data.isFinal) {
        console.log(`[WhistlAgent] Action: Executing Settlement on-chain.`);
        
        await this.solana.settlePact(
          data.pactPda, 
          data.creatorToken, 
          data.counterpartyToken, 
          data.escrowVault, 
          data
        );

        await this.aceData.logEvent("SETTLEMENT_EXECUTED", "Transaction successfully submitted and confirmed.", { pactPda: data.pactPda });
      }
    } catch (err) {
      console.error("[WhistlAgent] Agent execution failed:", err);
      await this.aceData.logEvent("EXECUTION_ERROR", String(err), data);
    }
  }
}
