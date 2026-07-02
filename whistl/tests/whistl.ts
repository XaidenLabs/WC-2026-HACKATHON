import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Whistl } from "../target/types/whistl";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";
import BN from "bn.js";

describe("whistl", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Whistl as Program<Whistl>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  const creator = anchor.web3.Keypair.generate();
  const counterparty = anchor.web3.Keypair.generate();
  let usdcMint: anchor.web3.PublicKey;
  let creatorTokenAccount: anchor.web3.PublicKey;
  let counterpartyTokenAccount: anchor.web3.PublicKey;

  const pactId = new anchor.BN(1);

  // Derive PDA for the Pact
  const [pactPda, pactBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("pact"), pactId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  // Derive PDA for the USDC Escrow
  const [escrowVault, escrowBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), pactPda.toBuffer()],
    program.programId
  );

  before(async () => {
    // Airdrop SOL to creator and counterparty
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        creator.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      )
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        counterparty.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      )
    );

    // Create mock USDC mint
    usdcMint = await createMint(
      provider.connection,
      creator,
      creator.publicKey,
      null,
      6
    );

    // Create token accounts
    creatorTokenAccount = await createAccount(
      provider.connection,
      creator,
      usdcMint,
      creator.publicKey
    );
    counterpartyTokenAccount = await createAccount(
      provider.connection,
      counterparty,
      usdcMint,
      counterparty.publicKey
    );

    // Mint USDC to both
    await mintTo(
      provider.connection,
      creator,
      usdcMint,
      creatorTokenAccount,
      creator,
      100_000_000 // 100 USDC
    );
    await mintTo(
      provider.connection,
      creator,
      usdcMint,
      counterpartyTokenAccount,
      creator,
      100_000_000 // 100 USDC
    );
  });

  it("Creates a Pact", async () => {
    const fixtureId = new anchor.BN(104);
    const stakeAmount = new anchor.BN(10_000_000); // 10 USDC
    const threshold = 3;
    const comparison = 0; // GreaterThan
    const statAKey = 7; // Corners P1
    const statAPeriod = 0;
    const hasStatB = true;
    const statBKey = 8; // Corners P2
    const statBPeriod = 0;
    const op = 1; // Subtract

    await program.methods
      .createPact(
        pactId,
        fixtureId,
        stakeAmount,
        threshold,
        comparison,
        statAKey,
        statAPeriod,
        hasStatB,
        statBKey,
        statBPeriod,
        op
      )
      .accounts({
        creator: creator.publicKey,
        pact: pactPda,
        creatorToken: creatorTokenAccount,
        escrowVault: escrowVault,
        usdcMint: usdcMint,
      })
      .signers([creator])
      .rpc();

    // Verify Pact State
    const pactState = await program.account.pact.fetch(pactPda);
    assert.equal(pactState.creator.toBase58(), creator.publicKey.toBase58());
    assert.equal(pactState.status, 0); // Created
    assert.equal(pactState.stakeAmount.toNumber(), stakeAmount.toNumber());

    // Verify Escrow Balance
    const escrowInfo = await getAccount(provider.connection, escrowVault);
    assert.equal(Number(escrowInfo.amount), stakeAmount.toNumber());
  });

  it("Counterparty accepts the Pact", async () => {
    await program.methods
      .acceptPact()
      .accounts({
        counterparty: counterparty.publicKey,
        pact: pactPda,
        counterpartyToken: counterpartyTokenAccount,
        escrowVault: escrowVault,
      })
      .signers([counterparty])
      .rpc();

    // Verify Pact State
    const pactState = await program.account.pact.fetch(pactPda);
    assert.equal(pactState.counterparty.toBase58(), counterparty.publicKey.toBase58());
    assert.equal(pactState.status, 1); // Accepted

    // Verify Escrow Balance (should now have both stakes)
    const escrowInfo = await getAccount(provider.connection, escrowVault);
    assert.equal(Number(escrowInfo.amount), 20_000_000);
  });
});
