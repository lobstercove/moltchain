---
description: "Create a new WASM smart contract for MoltChain. Scaffolds the contract directory, Cargo.toml, lib.rs, tests, and updates SKILL.md."
agent: "agent"
tools: [read, edit, search, execute, todo]
argument-hint: "Contract name, e.g. 'ai_marketplace'"
---
Create a new WASM smart contract for MoltChain. Follow these steps:

1. **Read existing contracts** — Pick a similar contract from `contracts/` as a template.
   - For named-export style: use `bountyboard` or `clawpay` as reference
   - For opcode-dispatch style: use `dex_core` or `dex_amm` as reference

2. **Create directory**: `contracts/<name>/`

3. **Create Cargo.toml**:
   ```toml
   [package]
   name = "<name>"
   version = "0.1.0"
   edition = "2021"
   
   [lib]
   crate-type = ["cdylib", "rlib"]
   
   [dependencies]
   # minimal — contracts run in WASM with host functions
   ```

4. **Implement `src/lib.rs`** — Full implementation with:
   - `initialize` function (sets admin)
   - All documented functions from the design doc
   - Admin access control
   - Pause/unpause
   - Proper error handling via return codes

5. **Write tests** — `tests/integration.rs` or inline `#[cfg(test)]`

6. **Verify build**:
   ```bash
   cd contracts/<name> && cargo build --target wasm32-unknown-unknown --release
   cd contracts/<name> && cargo test --release
   ```

7. **Update SKILL.md** §5 — Add the contract to the Contract Surface section

8. **Update genesis** (if deploying at genesis) — Add to `genesis/src/main.rs` contract list
