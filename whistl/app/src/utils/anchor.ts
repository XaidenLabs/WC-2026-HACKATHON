import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import whistlIdl from "./whistl.json";

export const WHISTL_PROGRAM_ID = new PublicKey(whistlIdl.address);

export function getProgram(provider: anchor.AnchorProvider) {
  return new anchor.Program(whistlIdl as anchor.Idl, provider);
}

// Helper to construct the create_pact instruction
export async function createPact(
  provider: anchor.AnchorProvider,
  amount: number,
  predictionType: string,
  fixtureId: string
) {
  const program = getProgram(provider);
  
  // PDAs
  const [pactPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pact"), provider.wallet.publicKey.toBuffer(), Buffer.from(fixtureId)],
    WHISTL_PROGRAM_ID
  );

  const [escrowVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), pactPda.toBuffer()],
    WHISTL_PROGRAM_ID
  );

  // In a real app we'd fetch the USDC mint. Using a mock PublicKey here for the hackathon.
  const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

  const tx = await program.methods
    .createPact(fixtureId, new anchor.BN(amount), { homeWin: {} })
    .accounts({
      creator: provider.wallet.publicKey,
      pact: pactPda,
      escrowVault: escrowVault,
      creatorToken: provider.wallet.publicKey, // Mock token account
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    })
    .rpc();

  return tx;
}
