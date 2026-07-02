#!/bin/bash
# Build Whistl Anchor program in WSL — smart copy excludes target/
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"

WIN_PROJECT="/mnt/c/Users/Xaiden Labs/Desktop/XaidenLabs/Whistl/whistl"
BUILD_DIR="$HOME/whistl-build"

echo "=== Setting up build directory ==="
mkdir -p "$BUILD_DIR"

# rsync only source files — exclude target/ and node_modules
rsync -a --delete \
  --exclude='target/' \
  --exclude='node_modules/' \
  --exclude='.anchor/' \
  "$WIN_PROJECT/" "$BUILD_DIR/"

# Remove any stale Cargo.lock — force regeneration with all vendor patches applied
rm -f "$BUILD_DIR/programs/whistl/Cargo.lock"
rm -f "$BUILD_DIR/Cargo.lock"

# Bring keypair into the right place
mkdir -p "$BUILD_DIR/target/deploy"
cp "$WIN_PROJECT/target/deploy/whistl-keypair.json" "$BUILD_DIR/target/deploy/"

echo "=== anchor version ==="
anchor --version

echo "=== solana version ==="
solana --version

echo "=== Building (Rust compile ~2-5 min first time) ==="
cd "$BUILD_DIR" && anchor build 2>&1

BUILD_EXIT=$?

if [ $BUILD_EXIT -eq 0 ]; then
  echo "=== Build SUCCEEDED. Copying artifacts back ==="
  mkdir -p "$WIN_PROJECT/target/deploy"
  mkdir -p "$WIN_PROJECT/target/idl"
  cp "$BUILD_DIR/target/deploy/whistl.so" "$WIN_PROJECT/target/deploy/"
  cp "$BUILD_DIR/target/idl/whistl.json" "$WIN_PROJECT/target/idl/" 2>/dev/null || true
  echo "=== Done. Program ID: $(cat $BUILD_DIR/target/idl/whistl.json | grep '\"address\"' | head -1) ==="
else
  echo "=== Build FAILED with exit code $BUILD_EXIT ==="
  exit 1
fi
