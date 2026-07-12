#!/bin/bash
# Deploy Whistl to Solana devnet using native anchor CLI
# Run from WSL: bash /mnt/c/Users/Xaiden\ Labs/Desktop/XaidenLabs/Whistl/deploy_whistl.sh

export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"

PROGRAM_ID="BZ2pNdsvpYmeC3dfLKzpKWKqqqKxPBHMPTYr3qVTMRTz"
BUILD_DIR="$HOME/whistl-build"

echo "=== Deployer wallet ==="
solana address
echo "=== Deployer balance ==="
solana balance --url devnet

echo "=== Deploying to devnet ==="
cd "$BUILD_DIR" && anchor deploy --provider.cluster devnet

echo "=== Publishing IDL ==="
anchor idl init \
  --filepath "$BUILD_DIR/target/idl/whistl.json" \
  "$PROGRAM_ID" \
  --provider.cluster devnet

echo "=== Program deployed: $PROGRAM_ID ==="
solana program show "$PROGRAM_ID" --url devnet
