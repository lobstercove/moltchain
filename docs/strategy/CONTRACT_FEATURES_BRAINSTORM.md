# Contract Features & Optimizations Brainstorm

> Ideas for extending MoltChain's WASM contract platform to attract serious developers.
> **Status:** Brainstorm — no implementation yet. Captured March 2026.
> **Context:** MoltChain currently has 16 host functions, 29 deployed contracts, and a flat-fee model (no gas).

---

## Current Capabilities

### Host Functions (WASM Imports)

| # | Function | Purpose |
|---|----------|---------|
| 1 | `storage_read` | Read value by key |
| 2 | `storage_read_result` | Retrieve buffered read result |
| 3 | `storage_write` | Write key-value pair |
| 4 | `storage_delete` | Remove key from storage |
| 5 | `log` | Emit text log message |
| 6 | `emit_event` | Emit structured JSON event |
| 7 | `get_timestamp` | Block timestamp |
| 8 | `get_caller` | Caller address |
| 9 | `get_contract_address` | Contract's own address |
| 10 | `get_value` | Transferred MOLT amount (shells) |
| 11 | `get_slot` | Current block slot |
| 12 | `get_args_len` | Argument buffer length |
| 13 | `get_args` | Read arguments |
| 14 | `set_return_data` | Set return value |
| 15 | `cross_contract_call` | Invoke another contract |
| 16 | `host_poseidon_hash` | Poseidon hash (ZK-friendly, BN254) |

### SDK Modules

Storage, contract args/return, logging, events, cross-contract calls, token, NFT, DEX pool, crypto (poseidon_hash), utilities.

### Fee Model (Relevant Context)

MoltChain uses **flat fees**, not gas:
- Base transaction: **0.001 MOLT** (1,000,000 shells)
- Contract deploy: **25 MOLT**
- Contract upgrade: **10 MOLT**
- Contract calls: base fee only (0.001 MOLT)
- Fee distribution: 40% burn, 30% producer, 10% voters, 10% treasury, 10% community

WASM compute units exist internally for sandbox safety (10M CU max per call) but are NOT charged to users. The flat fee model is a core design principle — agents need predictable, ultra-low costs.

---

## Tier 1 — New Host Functions

These unlock use cases that are currently impossible.

### 1. `host_ed25519_verify(pubkey_ptr, msg_ptr, msg_len, sig_ptr) → i32`

**Signature verification inside contracts.** The single most impactful addition.

- Lets contracts verify signatures on arbitrary messages
- Unlocks: gasless meta-transactions, multi-sig wallets as contracts, account abstraction, off-chain signed limit orders (DEX), permit-style token approvals
- Internal CU cost: ~10,000 (metering only, no user charge)

### 2. `host_keccak256(data_ptr, data_len, out_ptr)` — Keccak-256 Hash

- Essential for EVM compatibility bridges, Ethereum Merkle proof verification
- Any DeFi protocol that needs to verify cross-chain state
- Internal CU cost: ~1,500

### 3. `host_sha256(data_ptr, data_len, out_ptr)` — SHA-256 Hash

- Standard general-purpose hash for Merkle trees, commit-reveal schemes, content addressing
- Bitcoin compatibility for bridge proofs
- Internal CU cost: ~1,000

### 4. `host_vrf_random(seed_ptr, out_ptr)` — Verifiable Random Function

- Deterministic-but-unpredictable random value derived from current slot hash + contract seed
- All validators agree on the same output (deterministic consensus)
- Unlocks: on-chain gaming (lotteries, loot boxes, card shuffling), random NFT minting, fair validator selection in sub-protocols
- Internal CU cost: ~5,000

### 5. `host_block_hash(slot: u64, out_ptr)` — Historical Block Hash

- Access hash of a recent block (last 256 slots)
- Unlocks: commit-reveal randomness, time-delayed proofs, historical state verification
- Internal CU cost: ~500

### 6. `host_transfer(to_ptr, amount: u64) → i32` — Native MOLT Transfer

- Direct native MOLT transfer from contract balance without cross-contract call
- Unlocks: contracts as treasuries, bounty payouts, revenue sharing, liquidity mining rewards
- Simpler and more efficient than routing through token contracts
- Internal CU cost: ~2,000

### 7. `host_self_destruct(beneficiary_ptr)` — Contract Teardown

- Contract deletes itself and returns remaining MOLT to a beneficiary
- Useful for factory patterns, one-time-use contracts, cleanup of obsolete contracts
- Internal CU cost: ~3,000

---

## Tier 2 — SDK Features (No New Host Functions)

Built purely in the SDK crate using existing host functions. Dramatically improve developer experience.

### 8. Access Control Framework

OpenZeppelin-style `Ownable`, `AccessControl`, `Pausable` patterns:

```rust
use moltchain_contract_sdk::access::{Ownable, RoleBased};

#[ownable]  // Generates owner storage + only_owner() guard
#[roles("ADMIN", "MINTER", "PAUSER")]  // Generates role checks
```

- Every production contract needs access control
- Pure SDK code using `storage_get/set`
- #1 ask from Solidity developers migrating to a new chain

### 9. Reentrancy Guard

```rust
use moltchain_contract_sdk::security::ReentrancyGuard;
let _guard = ReentrancyGuard::lock(); // panics if already locked
```

- Uses a storage flag — prevents cross-contract callback attacks
- Critical for any DeFi protocol
- Minimal overhead

### 10. Typed Storage Collections

```rust
use moltchain_contract_sdk::collections::{StorageMap, StorageVec, StorageSet};

let balances: StorageMap<Address, u64> = StorageMap::new("balances");
balances.insert(&user, 1000);
let bal = balances.get(&user).unwrap_or(0);
```

- Currently developers manually serialize keys with string concatenation
- Typed API eliminates boilerplate and prevents key collision bugs
- `StorageMap<K, V>`, `StorageVec<T>`, `StorageSet<T>`, `StorageCounter`

### 11. Upgradeable Proxy Pattern

- SDK support for a proxy contract that delegates calls via `cross_contract_call`
- `ProxyAdmin` module: `upgrade(new_implementation)` guarded by owner
- Storage layout versioning helpers to prevent slot collisions during upgrades

### 12. Event Schema / ABI Generation

- Contracts define events as structs, compiler auto-generates ABI JSON alongside WASM
- Explorers and SDKs can decode events without manual schema knowledge

```rust
#[event]
struct Transfer { from: Address, to: Address, amount: u64 }
```

### 13. Math Libraries

- `FixedPoint` (u128 with 18 decimal places) for DeFi math without floating point
- `SafeMath` wrappers that panic with clear messages on overflow
- `sqrt`, `pow`, `log2` for AMM curve calculations
- `WadRay` math (like Aave's) for interest rate calculations

---

## Tier 3 — Runtime / VM Enhancements

### 14. Remaining Compute Budget Query

- `host_remaining_compute() → u64` so contracts can branch on remaining CU budget
- Useful for iterative operations that process as many items as CU allows, then return a cursor
- Guards against running out of compute in the middle of critical multi-step operations

### 15. Read-Only Cross-Contract Calls

- `cross_contract_call_readonly(contract, method, args)` — guarantees the target cannot write storage
- Like Solidity's `staticcall`
- Enables safe price oracle reads, balance queries without risk of state mutation

### 16. Contract-to-Contract Event Subscription

- Contracts register to receive callbacks when another contract emits a specific event
- Enables reactive architecture: oracle update → trigger liquidation → trigger insurance payout

### 17. Time-Lock / Scheduled Execution

- `host_schedule_call(contract, method, args, execute_after_slot)` — schedules future execution
- Validators execute scheduled calls when the target slot arrives
- Unlocks: governance timelocks, vesting schedules, recurring payments, options expiry

### 18. Meta-Transactions / Fee Sponsorship

- Allow a "relayer" account to pay the flat transaction fee on behalf of the actual signer
- Transaction includes inner signed message + outer relayer signature
- Eliminates the "users need MOLT to start" onboarding problem
- Critical for consumer-facing dApps and agent onboarding

---

## Tier 4 — Developer Tooling

### 19. Contract Testing Framework

```rust
use moltchain_contract_test::TestEnv;

#[cfg(test)]
let mut env = TestEnv::new();
env.set_caller(alice);
env.set_value(1_000_000);
env.call("transfer", &args);
assert_eq!(env.storage_get("balance:alice"), 0);
```

- Mock VM environment — developers test without deploying
- Run with `cargo test`
- Massive productivity boost

### 20. Contract Template Generator

```bash
molt new-contract --template token
```

Scaffolds a contract with `Cargo.toml`, standard implementation, tests, README.
Templates: `token`, `nft`, `dao`, `marketplace`, `staking`, `oracle`.

### 21. On-Chain Contract Verification

- Store source hash + compiler version on-chain during deploy
- Explorer can verify deployed WASM matches claimed source
- `molt verify <contract-id> --source ./src`

### 22. Compute Profiler

```bash
molt profile <wasm-file> --method transfer --args ...
```

Shows CU breakdown per host function call, memory allocation, and computation. Helps developers optimize hot paths.

---

## Tier 5 — Advanced / Future Ideas

### 23. WASM Component Model

- Move from flat WASM imports to the Component Model (WASI-like interfaces)
- Contracts import typed interfaces from other contracts at compile time
- Composability like Rust traits across contract boundaries

### 24. Parallel Execution Hints

- Contracts declare read/write sets upfront
- Non-overlapping transactions execute in parallel across CPU cores
- Massive throughput increase for independent operations

### 25. ZK Coprocessor

- `host_verify_groth16_proof(vk, proof, public_inputs)` — generic ZK proof verification
- Contracts verify arbitrary ZK proofs: private voting, confidential transfers, ZK-rollup settlement, privacy-preserving identity

### 26. Persistent Contract Memory (Heap Snapshots)

- Snapshot entire WASM linear memory between calls instead of individual key reads/writes
- Eliminates serialization overhead for complex data structures
- Trade-off: higher memory cost, but zero serde overhead

---

## Recommended Priority

| Priority | Feature | Impact | Effort |
|----------|---------|--------|--------|
| **P0** | `host_ed25519_verify` | Meta-tx, multisig, account abstraction | Medium |
| **P0** | `host_transfer` | Native MOLT from contracts | Low |
| **P0** | Typed Storage Collections | Every contract needs this | Medium |
| **P0** | Reentrancy Guard | Security critical for DeFi | Low |
| **P1** | `host_keccak256` + `host_sha256` | EVM compat, Merkle proofs | Low |
| **P1** | Access Control Framework | Every contract needs this | Medium |
| **P1** | Contract Testing Framework | Developer productivity | High |
| **P1** | `host_vrf_random` | Gaming, fair mint | Medium |
| **P2** | Math Libraries (FixedPoint, WadRay) | DeFi precision | Medium |
| **P2** | Read-only cross-contract calls | Safe oracle reads | Low |
| **P2** | Meta-transactions / Fee Sponsorship | Agent onboarding | High |
| **P2** | Template Generator | Developer onboarding | Medium |
| **P3** | `host_block_hash` | Commit-reveal patterns | Low |
| **P3** | Event Schema / ABI generation | Tooling quality | Medium |
| **P3** | `host_verify_groth16_proof` | Privacy features | High |
| **P3** | Parallel execution hints | Throughput scaling | Very High |

The **P0 items** (ed25519_verify, host_transfer, typed collections, reentrancy guard) would immediately put MoltChain on par with Solana's program capabilities and bring EVM-class safety patterns. Combined, they'd be a single release — a strong v0.3.0 milestone.
