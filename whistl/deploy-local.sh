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

echo "=== Deploying to Localhost ==="
cd "$PROJ/target/deploy"

# This assumes solana-test-validator is running
solana program deploy \
  --program-id whistl-keypair.json \
  --upgrade-authority ~/.config/solana/id.json \
  --url http://127.0.0.1:8899 \
  whistl.so
