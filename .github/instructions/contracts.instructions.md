---
description: "Use when editing WASM smart contracts in contracts/. Covers contract build targets, dispatch patterns, storage conventions, and testing."
applyTo: "contracts/**/*.rs"
---
# Smart Contract Development Guidelines

## Build Target
```bash
cargo build --target wasm32-unknown-unknown --release
```
Contracts are NOT part of the Cargo workspace — each has its own Cargo.toml.

## Two Dispatch Styles

### Named Exports (23 contracts)
Each function is a separate WASM export:
```rust
#[no_mangle]
pub extern "C" fn function_name() { /* ... */ }
```

### Opcode Dispatch (7 DEX contracts)
Single `call()` export, first byte is opcode:
```rust
#[no_mangle]
pub extern "C" fn call(args_ptr: u32, args_len: u32) {
    match data[0] {
        0x00 => initialize(&data[1..]),
        // ...
    }
}
```

## Storage
- Use `storage_read(key)` / `storage_write(key, value)` host functions
- Keys are byte strings — use consistent prefixing per contract
- Admin state typically at key `b"admin"` or `b"state"`

## Admin Patterns
- Every contract has `initialize` (sets admin)
- Admin-only functions must verify `caller == admin`
- Pause/unpause: `{prefix}_pause` / `{prefix}_unpause`
- Admin functions: `transfer_admin`, `set_*_address`

## Testing
- Native tests (not WASM) — test logic without VM overhead
- Test both success paths and error/revert paths
- Test admin access control (unauthorized callers must fail)
- Test pause behavior (operations must fail when paused)
