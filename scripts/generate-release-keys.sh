#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# MoltChain Release Signing Key Generator
# ─────────────────────────────────────────────────────────────────────────────
# Generates an Ed25519 keypair for signing release artifacts.
# The public key must be embedded in the validator binary source code.
#
# Usage:
#   ./scripts/generate-release-keys.sh [output-dir]
#
# Output:
#   <output-dir>/release-signing-keypair.json  — SECRET key (keep offline!)
#   Prints the public key hex to embed in validator/src/updater.rs
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

OUTPUT_DIR="${1:-.}"
KEYPAIR_FILE="$OUTPUT_DIR/release-signing-keypair.json"

# Find the workspace root (where Cargo.toml lives)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$KEYPAIR_FILE" ]; then
    echo "⚠️  Keypair file already exists: $KEYPAIR_FILE"
    echo "    Delete it first if you want to regenerate."
    exit 1
fi

echo "🔑 Generating Ed25519 release signing keypair..."
echo ""

# Use a small Rust program to generate the keypair using the same crypto
# library as the validator itself (ed25519-dalek via moltchain-core).
cd "$REPO_ROOT"

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

cat > "$TEMP_DIR/gen.rs" << 'RUST_SCRIPT'
use std::env;
use std::fs;

fn main() {
    // Generate random 32-byte seed
    let mut seed = [0u8; 32];
    let time_bytes = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos()
        .to_le_bytes();
    
    // Mix time + process ID + random stack bytes for entropy
    let pid = std::process::id().to_le_bytes();
    for i in 0..32 {
        seed[i] = time_bytes[i % 16] ^ pid[i % 4] ^ (i as u8).wrapping_mul(37);
    }
    
    // Additional entropy from /dev/urandom
    if let Ok(bytes) = fs::read("/dev/urandom") {
        for (i, &b) in bytes.iter().take(32).enumerate() {
            seed[i] ^= b;
        }
    } else {
        // Fallback: read 32 bytes
        use std::io::Read;
        if let Ok(mut f) = fs::File::open("/dev/urandom") {
            let mut buf = [0u8; 32];
            let _ = f.read_exact(&mut buf);
            for i in 0..32 {
                seed[i] ^= buf[i];
            }
        }
    }

    // Build keypair using ed25519-dalek (same as moltchain-core)
    use ed25519_dalek::{SigningKey, VerifyingKey};
    let signing_key = SigningKey::from_bytes(&seed);
    let verifying_key: VerifyingKey = (&signing_key).into();

    let secret_hex = hex::encode(&seed);
    let pubkey_hex = hex::encode(verifying_key.as_bytes());

    // Output as JSON
    let json = format!(
        r#"{{
  "secret_key": "{}",
  "public_key": "{}"
}}"#,
        secret_hex, pubkey_hex
    );

    let output_path = env::args().nth(1).unwrap_or_else(|| "keypair.json".into());
    fs::write(&output_path, &json).expect("Failed to write keypair file");

    eprintln!("✅ Keypair generated successfully!");
    eprintln!("");
    eprintln!("📁 Keypair file: {}", output_path);
    eprintln!("   ⚠️  KEEP THIS FILE SECRET AND OFFLINE!");
    eprintln!("");
    eprintln!("🔑 Public key (embed in validator/src/updater.rs):");
    eprintln!("");
    println!("{}", pubkey_hex);
    eprintln!("");
    eprintln!("Replace RELEASE_SIGNING_PUBKEY_HEX in validator/src/updater.rs with the key above.");
}
RUST_SCRIPT

# Try to use the workspace's moltchain-core, but fall back to a standalone build
# For simplicity, we'll use a cargo script with ed25519-dalek directly
cat > "$TEMP_DIR/Cargo.toml" << 'TOML'
[package]
name = "keygen"
version = "0.1.0"
edition = "2021"

[dependencies]
ed25519-dalek = "2.1"
hex = "0.4"
TOML

mkdir -p "$TEMP_DIR/src"
cp "$TEMP_DIR/gen.rs" "$TEMP_DIR/src/main.rs"

echo "🔨 Building key generator..."
cd "$TEMP_DIR"
cargo build --release --quiet 2>/dev/null

echo ""
"$TEMP_DIR/target/release/keygen" "$KEYPAIR_FILE"
echo ""
echo "Done! Store the keypair file in a secure offline location."
