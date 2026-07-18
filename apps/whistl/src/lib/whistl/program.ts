// WHISTL on-chain program client — builds create_pact / accept_pact / settle_pact instructions
// from the deployed IDL. Used client-side (user signs via Privy) and server-side (ORA signs).
import { AnchorProvider, Program, BN, type Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import idlJson from "./idl.json";

export const WHISTL_IDL = idlJson as Idl;
export const WHISTL_PROGRAM_ID = new PublicKey((idlJson as { address: string }).address);
export const TXLINE_PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
export const TEST_USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_TEST_USDC_MINT ?? "39JZ9WAeAsFPGarDJ6NAAKvNQka1xoQDz44KB2rMQCc9",
);
export const USDC_DECIMALS = 6;

const te = new TextEncoder();

// u64 little-endian — browser-safe, no Buffer dependency.
function u64le(n: bigint): Uint8Array {
  const b = new Uint8Array(8);
  let x = n;
  for (let i = 0; i < 8; i++) {
    b[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return b;
}

// u16 little-endian for PDA seeds.
function u16le(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
}

export function pactPda(pactId: bigint): PublicKey {
  return PublicKey.findProgramAddressSync([te.encode("pact"), u64le(pactId)], WHISTL_PROGRAM_ID)[0];
}
export function escrowPda(pact: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([te.encode("escrow"), pact.toBytes()], WHISTL_PROGRAM_ID)[0];
}
export function usdcAta(owner: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(TEST_USDC_MINT, owner);
}
export function fixtureMetaPda(fixtureId: number): PublicKey {
  return PublicKey.findProgramAddressSync([te.encode("fixture_meta"), u64le(BigInt(fixtureId))], WHISTL_PROGRAM_ID)[0];
}
export function commentaryEntryPda(fixtureId: number, sequence: number): PublicKey {
  return PublicKey.findProgramAddressSync([te.encode("commentary"), u64le(BigInt(fixtureId)), u64le(BigInt(sequence))], WHISTL_PROGRAM_ID)[0];
}

export const toBaseUnits = (usdc: number): bigint => BigInt(Math.round(usdc * 10 ** USDC_DECIMALS));

// daily_scores_roots PDA lives on the TXLINE program, seeded by epochDay (u16 LE).
export function dailyScoresRootsPda(minTimestampMs: number): PublicKey {
  const epochDay = Math.floor(minTimestampMs / 86_400_000);
  return PublicKey.findProgramAddressSync(
    [te.encode("daily_scores_roots"), u16le(epochDay)],
    TXLINE_PROGRAM_ID,
  )[0];
}

// Hex string (with or without 0x prefix) → number[32] for on-chain [u8; 32] args.
export function hexToBytes32(hex: string): number[] {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const arr: number[] = [];
  for (let i = 0; i < 32; i++) {
    arr.push(parseInt(clean.slice(i * 2, i * 2 + 2) || "00", 16));
  }
  return arr;
}

// Minimal anchor-compatible wallet (Privy adapter or Keypair-backed NodeWallet satisfy this).
export interface AnchorWalletLike {
  publicKey: PublicKey;
  signTransaction: <T>(tx: T) => Promise<T>;
  signAllTransactions: <T>(txs: T[]) => Promise<T[]>;
}

export function getProgram(connection: Connection, wallet: AnchorWalletLike): Program {
  const provider = new AnchorProvider(connection, wallet as never, { commitment: "confirmed" });
  return new Program(WHISTL_IDL, provider);
}

export type PactTermsArgs = {
  threshold: number;
  comparison: number; // 0 > | 1 < | 2 =
  statAKey: number;
  statAPeriod: number;
  hasStatB: boolean;
  statBKey: number;
  statBPeriod: number;
  op: number | null; // 0 add | 1 subtract
};

type ProofNodeRaw = { hash: string; isRightSibling: boolean };

function mapProofNodes(nodes: ProofNodeRaw[]): { hash: number[]; isRightSibling: boolean }[] {
  return nodes.map((n) => ({ hash: hexToBytes32(n.hash), isRightSibling: n.isRightSibling }));
}

// Full proof bundle as returned by GET /api/txline/proof (which wraps /api/scores/stat-validation).
export type SettlePactProof = {
  ts: number;
  statToProve: { key: number; value: number; period: number };
  statToProve2?: { key: number; value: number; period: number };
  eventStatRoot: string;
  eventStatRoot2?: string;
  summary: {
    fixtureId: number;
    updateStats: { updateCount: number; minTimestamp: number; maxTimestamp: number };
    eventStatsSubTreeRoot: string;
  };
  statProof: ProofNodeRaw[];
  statProof2?: ProofNodeRaw[];
  subTreeProof: ProofNodeRaw[];
  mainTreeProof: ProofNodeRaw[];
};

/** create_pact — creator locks their USDC stake into a fresh escrow PDA. */
export function buildCreatePact(
  program: Program,
  p: { pactId: bigint; fixtureId: number; stakeBaseUnits: bigint; terms: PactTermsArgs; creator: PublicKey },
) {
  const pact = pactPda(p.pactId);
  return program.methods
    .createPact(
      new BN(p.pactId.toString()),
      new BN(p.fixtureId),
      new BN(p.stakeBaseUnits.toString()),
      p.terms.threshold,
      p.terms.comparison,
      p.terms.statAKey,
      p.terms.statAPeriod,
      p.terms.hasStatB,
      p.terms.statBKey,
      p.terms.statBPeriod,
      p.terms.op,
    )
    .accounts({
      creator: p.creator,
      pact,
      creatorToken: usdcAta(p.creator),
      escrowVault: escrowPda(pact),
      usdcMint: TEST_USDC_MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/** accept_pact — ORA locks its odds-priced counter-stake into escrow.
 *  counterpartyStakeBaseUnits = creatorStake * (1 - pTrue) / pTrue  (fair line). */
export function buildAcceptPact(
  program: Program,
  p: { pactId: bigint; counterparty: PublicKey; counterpartyStakeBaseUnits: bigint },
) {
  const pact = pactPda(p.pactId);
  return program.methods
    .acceptPact(new BN(p.counterpartyStakeBaseUnits.toString()))
    .accounts({
      counterparty: p.counterparty,
      pact,
      counterpartyToken: usdcAta(p.counterparty),
      escrowVault: escrowPda(pact),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

/** settle_pact — submits Merkle proof, CPIs validate_stat, pays winner.
 *  ts MUST be proof.summary.updateStats.minTimestamp (not maxTimestamp, not event ts). */
export function buildSettlePact(
  program: Program,
  p: {
    pactId: bigint;
    creator: PublicKey;
    counterparty: PublicKey;
    settler: PublicKey;
    proof: SettlePactProof;
  },
) {
  const pact = pactPda(p.pactId);
  const { summary } = p.proof;
  const minTs = summary.updateStats.minTimestamp;

  return program.methods
    .settlePact(
      new BN(minTs.toString()),
      {
        fixtureId: new BN(summary.fixtureId),
        updateStats: {
          updateCount: summary.updateStats.updateCount,
          minTimestamp: new BN(minTs.toString()),
          maxTimestamp: new BN(summary.updateStats.maxTimestamp.toString()),
        },
        eventsSubTreeRoot: hexToBytes32(summary.eventStatsSubTreeRoot),
      },
      mapProofNodes(p.proof.subTreeProof),
      mapProofNodes(p.proof.mainTreeProof),
      p.proof.statToProve.value,
      hexToBytes32(p.proof.eventStatRoot),
      mapProofNodes(p.proof.statProof),
      p.proof.statToProve2?.value ?? 0,
      hexToBytes32(p.proof.eventStatRoot2 ?? "0".repeat(64)),
      mapProofNodes(p.proof.statProof2 ?? []),
    )
    .accounts({
      settler: p.settler,
      pact,
      creatorToken: usdcAta(p.creator),
      counterpartyToken: usdcAta(p.counterparty),
      escrowVault: escrowPda(pact),
      dailyScoresMerkleRoots: dailyScoresRootsPda(minTs),
      txlineProgram: TXLINE_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

/** save_commentary — called by ORA to save commentary on-chain */
export async function buildSaveCommentary(
  program: Program,
  p: {
    fixtureId: number;
    headline: string;
    analysis: string;
    market: string;
    source: string;
    timestamp: number;
    author: PublicKey;
  },
) {
  const metaPda = fixtureMetaPda(p.fixtureId);
  let sequence = 0;
  try {
    const meta = await (program.account as any).fixtureMeta.fetch(metaPda);
    sequence = Number(meta.count.toString());
  } catch {
    // If it doesn't exist, sequence is 0
  }

  return program.methods
    .saveCommentary(
      new BN(p.fixtureId),
      new BN(sequence),
      p.headline,
      p.analysis,
      p.market,
      p.source,
      new BN(p.timestamp.toString()),
    )
    .accounts({
      author: p.author,
      fixtureMeta: metaPda,
      commentaryEntry: commentaryEntryPda(p.fixtureId, sequence),
    })
    .instruction();
}
