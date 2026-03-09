---
description: "Add a new RPC endpoint to MoltChain. Handles the full flow: handler implementation, route registration, SKILL.md update, and test creation."
agent: "agent"
tools: [read, edit, search, execute, todo]
argument-hint: "Method name, e.g. 'getReefStakePoolInfo'"
---
Implement a new RPC endpoint for MoltChain. Follow these steps exactly:

1. **Check SKILL.md** — Is this method already documented? If so, read its expected params and return format.
2. **Read `rpc/src/lib.rs`** — Understand the existing handler registration pattern.
3. **Implement the handler** — Write the full handler function. No stubs, no TODOs.
4. **Register the route** — Add the method name to the match statement in the RPC dispatcher.
5. **Add REST route if applicable** — Some methods also have REST equivalents under `/api/v1/`.
6. **Write a test** — Add a test that:
   - Sends a JSON-RPC request with valid params
   - Verifies the response structure matches the documented format
   - Tests error cases (missing params, invalid pubkey, etc.)
7. **Update SKILL.md** — Add the method to the appropriate section in §11 (RPC Methods).
8. **Verify**: `cargo build --release` and `cargo test --workspace --release`
