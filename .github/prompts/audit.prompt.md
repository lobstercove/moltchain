---
description: "Run a full production readiness audit on the codebase. Checks build, clippy, tests, contract compilation, and endpoint wiring."
agent: "agent"
tools: [read, search, execute, todo]
argument-hint: "Scope: all, core, contracts, frontend, or specific crate name"
---
Run a comprehensive production readiness audit on MoltChain.

## Checks to perform (in order):

1. **Build check**: `cargo build --release` — must produce zero errors and zero warnings
2. **Clippy**: `cargo clippy --workspace -- -D warnings` — must be clean
3. **Workspace tests**: `cargo test --workspace --release` — all must pass
4. **Contract builds**: `make build-contracts-wasm` — all 29 contracts compile to WASM
5. **Contract tests**: `make test-contracts` — all contract test suites pass
6. **Code scan**: Search for any remaining TODOs, stubs, placeholder, unimplemented!(), or todo!() macros in shipped code
7. **Endpoint audit**: Compare RPC methods listed in SKILL.md §11 against actual handler registrations in `rpc/src/lib.rs`
8. **Dead code**: Check for registered handlers that return stub/placeholder responses

## Output format:
For each check, report PASS or FAIL with details.
At the end, produce a summary table of findings and recommended next actions.
