import test from "node:test";
import assert from "node:assert/strict";
import {
  createWalletReview,
  DAILY_FAUCET_LIMIT,
  isValidAmount,
  isValidDevnetConfig,
  shortAddress,
} from "./domain.ts";

test("accepts an explicit devnet RPC and rejects other clusters", () => {
  assert.equal(isValidDevnetConfig("devnet", "https://api.devnet.solana.com"), true);
  assert.equal(isValidDevnetConfig("mainnet-beta", "https://api.mainnet-beta.solana.com"), false);
  assert.equal(isValidDevnetConfig("devnet", "http://api.devnet.solana.com"), false);
});

test("wallet amounts are positive, bounded, and limited to cents", () => {
  assert.equal(isValidAmount(10, 100), true);
  assert.equal(isValidAmount(10.25, 100), true);
  assert.equal(isValidAmount(10.001, 100), false);
  assert.equal(isValidAmount(0, 100), false);
  assert.equal(isValidAmount(101, 100), false);
});

test("faucet review is devnet-only and capped", () => {
  const review = createWalletReview({ action: "faucet", amount: DAILY_FAUCET_LIMIT, destination: "wallet" });
  assert.equal(review.cluster, "devnet");
  assert.equal(review.simulationRequired, true);
  assert.equal(review.feePayer, "TXAgent devnet faucet");
  assert.throws(() => createWalletReview({ action: "faucet", amount: DAILY_FAUCET_LIMIT + 1, destination: "wallet" }));
});

test("allocation fails closed until the escrow deployment is verified", () => {
  assert.throws(() => createWalletReview({ action: "allocate", amount: 10, destination: "vault", availableBalance: 50, escrowReady: false }), /ESCROW_DEPLOYMENT_REQUIRED/);
  const review = createWalletReview({ action: "allocate", amount: 10, destination: "vault", availableBalance: 50, escrowReady: true });
  assert.equal(review.feePayer, "Your embedded wallet");
});

test("addresses are shortened without losing their identity", () => {
  assert.equal(shortAddress("39JZ9WAeAsFPGarDJ6NAAKvNQka1xoQDz44KB2rMQCc9"), "39JZ9...MQCc9");
});
