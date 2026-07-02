import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";

dotenv.config();

export class SolanaManager {
  private provider: anchor.AnchorProvider;
  private program: Program;

  constructor() {
    const connection = new Connection(process.env.RPC_URL || "http://127.0.0.1:8899", "confirmed");
    
    // Default to a dummy keypair if not provided (for hackathon demo)
    const secretKeyStr = process.env.AGENT_SECRET_KEY;
    const wallet = secretKeyStr 
      ? new anchor.Wallet(Keypair.fromSecretKey(bs58.decode(secretKeyStr)))
      : new anchor.Wallet(Keypair.generate());

    this.provider = new anchor.AnchorProvider(connection, wallet, {
      preflightCommitment: "confirmed",
    });

    anchor.setProvider(this.provider);

    // Dynamic import to avoid strict dependency coupling
    const idl = require("../../whistl/target/idl/whistl.json");
    this.program = new Program(idl, this.provider);
  }

  async settlePact(
    pactPda: string,
    creatorToken: string,
    counterpartyToken: string,
    escrowVault: string,
    txoddsData: any
  ) {
    console.log(`[Solana] Attempting to settle pact: ${pactPda}`);
    
    // Format arguments exactly as TxLINE validates them
    const tx = await this.program.methods
      .settlePact(
        new anchor.BN(txoddsData.ts),
        txoddsData.fixtureSummary,
        txoddsData.fixtureProof,
        txoddsData.mainTreeProof,
        txoddsData.statAValue,
        txoddsData.statAEventRoot,
        txoddsData.statAProof,
        txoddsData.statBValue || 0,
        txoddsData.statBEventRoot || Array(32).fill(0),
        txoddsData.statBProof || []
      )
      .accounts({
        settler: this.provider.wallet.publicKey,
        pact: new PublicKey(pactPda),
        creatorToken: new PublicKey(creatorToken),
        counterpartyToken: new PublicKey(counterpartyToken),
        escrowVault: new PublicKey(escrowVault),
        dailyScoresMerkleRoots: new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"), // Dummy TxOracle state
        txlineProgram: new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"),
      })
      .rpc();

    console.log(`[Solana] Successfully settled pact! Signature: ${tx}`);
    return tx;
  }
}
