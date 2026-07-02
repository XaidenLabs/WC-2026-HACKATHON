#!/bin/bash
set -e
PROJ="/mnt/c/Users/Xaiden Labs/Desktop/XaidenLabs/Whistl/whistl"

echo "=== Build artifacts ==="
ls "$PROJ/programs/whistl/target/deploy/"

echo "=== Copying to whistl/target/deploy/ ==="
mkdir -p "$PROJ/target/deploy"
cp "$PROJ/programs/whistl/target/deploy/whistl.so" "$PROJ/target/deploy/"
cp "$PROJ/programs/whistl/target/deploy/whistl-keypair.json" "$PROJ/target/deploy/"
echo "Copied OK"

echo "=== Deploying to devnet ==="
cd "$PROJ/target/deploy"
solana program deploy \
  --program-id whistl-keypair.json \
  --upgrade-authority ~/.config/solana/id.json \
  --url https://devnet.helius-rpc.com/?api-key=7d792a02-f4bc-4ff9-b2ee-d9eee7df0656 \
  whistl.so
