---
description: "Use when editing Rust source files in the MoltChain workspace. Covers coding style, error handling, testing patterns, and Cargo workspace conventions."
applyTo: "**/*.rs"
---
# Rust Development Guidelines

## Workspace
- Members: core, validator, rpc, cli, p2p, faucet-service, custody, genesis
- Contracts are NOT workspace members — each has its own Cargo.toml
- Resolver: 2

## Build Verification
After any Rust change, verify:
```bash
cargo build --release              # Zero errors, zero warnings
cargo clippy --workspace -- -D warnings  # Clean lint
cargo test --workspace --release   # All tests pass
```

## Conventions
- Use `serde_json::json!({})` for JSON-RPC responses
- Binary data: `[u8; 32]` for keys/hashes, `u64` for amounts in shells
- All amounts in shells (1 MOLT = 1,000,000,000 shells) — never floating point
- Ed25519 signatures: 64 bytes, public keys: 32 bytes
- Transaction data: bincode serialization → base64 for transport

## Error Handling
- Return `Result<T, E>` with descriptive error types
- RPC errors use JSON-RPC error codes (-32600 to -32603 for standard, custom for app-level)
- Never `unwrap()` in production paths — only in tests

## State Access Patterns
- `Arc<Mutex<State>>` for shared state
- `Arc<RwLock<T>>` for read-heavy shared data
- Clone Arcs for thread/task boundaries, never move the inner value
