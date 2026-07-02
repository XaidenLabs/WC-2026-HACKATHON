#!/bin/bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
solana-keygen new --no-bip39-passphrase -s -o /tmp/new-keypair.json --force
solana address -k /tmp/new-keypair.json
cp /tmp/new-keypair.json "/mnt/c/Users/Xaiden Labs/Desktop/XaidenLabs/Whistl/whistl/target/deploy/whistl-keypair.json"
