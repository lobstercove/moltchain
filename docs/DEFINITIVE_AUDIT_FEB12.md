# MoltChain — Definitive Code Audit

**Date:** February 12, 2026  
**Scope:** Full codebase sweep — every file in `core/`, `validator/`, `p2p/`, `rpc/`  
**Method:** Every finding below was verified against the actual source code with exact line numbers. No speculation, no "could be improved" — only real bugs and real behavior.

---

## Files Audited

| File | Lines | Status |
|------|-------|--------|
| core/src/processor.rs | 2406 | 7 findings |
| core/src/consensus.rs | 2110 | Clean |
| core/src/state.rs | 4101 | 1 finding |
| core/src/block.rs | 417 | Clean (tx_root is flat hash — noted) |
| core/src/transaction.rs | ~250 | Clean |
| core/src/account.rs | 327 | Clean |
| core/src/genesis.rs | 440 | Clean |
| core/src/mempool.rs | 384 | Clean |
| core/src/evm.rs | 787 | Clean |
| core/src/hash.rs | ~80 | Clean |
| core/src/contract.rs | ~600 | Clean |
| core/src/event_stream.rs | ~100 | Clean |
| core/src/privacy.rs | 267 | Placeholder (documented) |
| core/src/multisig.rs | 254 | Not wired into processor |
| validator/src/main.rs | 3982 | 6 findings |
| validator/src/sync.rs | ~200 | Clean |
| validator/src/threshold_signer.rs | ~150 | Clean |
| p2p/src/network.rs | ~500 | Clean |
| p2p/src/gossip.rs | ~100 | Clean |
| p2p/src/peer.rs | ~150 | Clean |
| p2p/src/message.rs | ~250 | Clean |
| p2p/src/peer_ban.rs | ~100 | Clean |
| p2p/src/peer_store.rs | ~100 | Clean |
| rpc/src/lib.rs | ~6000 | 5 findings |

---

## THE LIST — 19 Confirmed Findings

---

### #1 — Received P2P blocks never execute transactions (STATE DIVERGENCE)

**Severity:** Critical  
**Where:** validator/src/main.rs L2270  

When a block arrives from P2P, it's stored and `apply_block_effects` runs (rewards + fees). But `process_transaction` is NEVER called on the block's transactions. The only call to `process_transaction` anywhere in the validator is at L3790 inside the block production loop (the leader's path).

This means: on every non-producing validator, user transfers, contract calls, staking operations, NFT mints — none of them execute. Account balances only update on the node that produced the block. Every other node has stale/wrong balances. State diverges immediately after the first block with transactions.

Additionally, since `charge_fee` never runs on receivers, the treasury never gets credited the fee amounts, but `apply_block_effects` still debits treasury for fee distribution → treasury drains faster on non-producer nodes.

---

### #2 — Double fee burn (burned counter inflated 2x, treasury drained)

**Severity:** Critical  
**Where:** processor.rs L1088 + main.rs L911

`charge_fee` in processor.rs already calls `add_burned(burn_amount)` and sends only `fee - burn` to treasury. Then `apply_block_effects` in main.rs calls `add_burned(burn)` AGAIN and debits treasury by `burn + producer_share + voters_paid`.

Math for a 10,000 shell fee (50/30/10/10 config):
- charge_fee: burns 5,000, credits treasury 5,000
- apply_block_effects: burns 5,000 AGAIN, debits treasury 9,000
- Result: burned counter = 10,000 (should be 5,000), treasury net = -4,000 (should be +1,000)

This only affects the producer node (where both paths run). On receiver nodes, only apply_block_effects runs (see #1).

---

### #3 — No validation on received P2P blocks

**Severity:** Critical  
**Where:** validator/src/main.rs L2270

The ONLY check before accepting a P2P block is parent hash continuity:
```
if block.header.parent_hash == parent.hash()
```

The Block struct has `verify_signature()` and `validate_structure()` methods, but neither is called ANYWHERE in the validator (confirmed via grep — zero matches). Not called for P2P blocks, not called for sync blocks, not called for fork choice blocks.

Any peer can craft a block with a correct parent hash and any validator identity. `apply_block_effects` then credits a block reward to whatever pubkey is in `header.validator`.

---

### #4 — Fee-free instruction types 2-5 have no signer authorization

**Severity:** High  
**Where:** processor.rs L127-136 (fee), L1128-1134 (routing)

Types 2 (reward), 3 (grant_repay), 4 (genesis_transfer), 5 (genesis_mint) pay 0 fees and execute as normal `system_transfer`. No check on who signed. Any user can set `data[0] = 2` and transfer their own funds fee-free.

Worse: `compute_transaction_fee` returns 0 when the FIRST instruction is type 2-5. A multi-instruction transaction with type 2 first and expensive operations after (contract deploy = 2.5 MOLT, NFT collection = 100 MOLT) pays zero total fees.

---

### #5 — Unstake targets wrong validator (staker-validator mismatch)

**Severity:** High  
**Where:** processor.rs L1390-1410

`system_request_unstake` takes `staker = accounts[0]`, `validator = accounts[1]`. Checks that staker has enough `staked` balance, but calls `pool.request_unstake(&validator, ...)` without verifying the staker actually staked to that validator. The StakePool tracks per-validator totals, not per-staker-per-validator mappings.

A user who staked to ValidatorA can craft a transaction with `accounts[1] = ValidatorB` and deduct from ValidatorB's pool stake, potentially dropping it below the 10K minimum and deactivating it.

---

### #6 — claim_unstake requires the validator to sign, not the staker

**Severity:** High  
**Where:** processor.rs L1419-1444

`system_claim_unstake` has `validator = accounts[0]` as the required signer (the processor verifies `accounts[0]` per instruction as the signer). The staker is `accounts[1]`. The staker's funds are locked, but they can't unlock them without the validator's keypair signing the claim transaction. A hostile or offline validator blocks fund recovery.

(Currently staker == validator in normal flows since delegation isn't live. Becomes a real problem when delegation activates.)

---

### #7 — EVM state changes bypass atomic batch

**Severity:** High  
**Where:** processor.rs L946-993, evm.rs L404-469

`execute_evm_transaction` receives `self.state.clone()` and REVM's `transact_commit` writes balance/storage changes directly to RocksDB via the `DatabaseCommit` trait. Then the processor opens a batch for the receipt/record. If the batch fails (disk full, etc.), EVM balance changes are already persisted but no receipt exists. Money moved but the transaction is unrecorded.

---

### #8 — Fork choice: replaced block's rewards never reverted

**Severity:** High  
**Where:** validator/src/main.rs L2380-2430

When a block at an existing slot is replaced via fork choice (higher vote weight), `apply_block_effects` runs for the new block. But the per-slot guards (reward_distribution_hash, fee_distribution_hash) detect the slot already has a distribution → skip. Result: the OLD block's producer keeps their undeserved rewards, the NEW canonical block's producer gets nothing.

---

### #9 — Snapshot response fully replaces validator set from any single peer

**Severity:** High  
**Where:** validator/src/main.rs L3025-3045

Any connected peer can send a SnapshotResponse with an arbitrary validator set, and the receiver does `*vs = remote_set.clone()` — full replacement. One malicious peer can remove all legitimate validators and insert only itself. Guard checks are minimal (not empty, hash differs from local).

---

### #10 — contract_close permanently loses staked/locked balance

**Severity:** Medium  
**Where:** processor.rs L1798-1826

Only `spendable` balance is transferred to the destination on close. Any `staked` or `locked` balance in the contract account stays behind in a non-executable, data-cleared account. Those funds are permanently inaccessible.

---

### #11 — NFT token_id uniqueness not enforced within collection

**Severity:** Medium  
**Where:** processor.rs L1286-1310

Minting checks that the token account address doesn't already exist, but not that the `token_id` is unique within the collection. Two separate token accounts can hold NFTs with the same `token_id` in the same collection, breaking lookups and enabling counterfeit duplicates.

---

### #12 — Simulation returns wrong fee (no reputation discount)

**Severity:** Medium  
**Where:** processor.rs L735-740 vs L559-562

`simulate_transaction` uses `compute_transaction_fee` without `apply_reputation_fee_discount`. For a user with 1000+ reputation, the simulated fee is 30% higher than the actual fee. Clients that use simulation for fee budgets show inflated costs.

---

### #13 — StateBatch event key collision (same-name events overwritten)

**Severity:** Medium  
**Where:** state.rs L2400-2430

The batch event key is `program(32) + slot(8) + name_hash(8)`. Two events with the same name in the same slot (e.g., two "Transfer" events in a batch token operation) produce the same key → second silently overwrites first. The non-batch `StateStore::put_contract_event` uses `next_event_seq` and doesn't have this bug.

---

### #14 — getAccountInfo RPC truncates MOLT to integer

**Severity:** Medium  
**Where:** rpc/src/lib.rs L3418

```rust
"molt": balance / 1_000_000_000,
```

Integer division. 1.5 MOLT returns `"molt": 1`. Every other endpoint uses `as f64 / 1_000_000_000.0`.

---

### #15 — Validator uptime calculation is wrong

**Severity:** Medium  
**Where:** rpc/src/lib.rs L3067-3074

The formula computes `(last_active_slot - joined_slot) / (current_slot - joined_slot)`, which measures "how far through the lifetime the last activity was" — not actual uptime. A validator offline 99% but active recently shows ~99% uptime.

---

### #16 — setFeeConfig can't set fee_treasury_percent

**Severity:** Low  
**Where:** rpc/src/lib.rs L1420-1443

The endpoint accepts burn/producer/voters percentages but not treasury. Then validates all four sum to 100. Changing any three without adjusting the fourth (which you can't) fails validation.

---

### #17 — getChainStatus and getStakingStatus return stale stake values

**Severity:** Low  
**Where:** rpc/src/lib.rs L3096, L3287

Both endpoints read `ValidatorInfo.stake` from the validator records instead of querying the authoritative StakePool. After any stake/unstake operation, these endpoints lag behind `getValidators` and `getMetrics` (which correctly query StakePool).

---

### #18 — requestAirdrop creates accounts with wrong owner

**Severity:** Low  
**Where:** rpc/src/lib.rs L5883

New accounts from airdrop get `owner = SYSTEM_ACCOUNT_OWNER` (Pubkey([0x01;32])). Every other code path creates accounts with the account's own pubkey as owner. Inconsistency could affect owner-based authorization checks.

---

### #19 — RPC/WS port derivation panics for non-default P2P ports

**Severity:** Low  
**Where:** validator/src/main.rs L3165-3180

For `--p2p-port` values 1-7999 (except 8000), the subtraction `p2p_port - 8001` underflows → panic in debug, wrap in release. For ports above ~40000, multiplication overflows u16.

---

## NOTES (Not Bugs)

**Block tx_root is a flat hash, not a Merkle tree** (block.rs L177-188). Works for integrity, but no compact inclusion proofs possible → no SPV/light clients. The state_root IS a proper Merkle tree.

**Privacy module is a documented placeholder** (privacy.rs). The file header says "will be replaced with actual ZK circuits." No user-facing path currently calls it.

**Multi-sig enforcement not in processor** (multisig.rs exists but verify_threshold never called during tx processing). Genesis multi-sig is a ceremony, not enforced on-chain.

**`generate_genesis_distribution()` is dead code** (genesis.rs L271-312). The 6-way whitepaper distribution function exists but is never called. Actual genesis creates 2 accounts.

**Bootstrap 100K MOLT is created via Account::new without a treasury debit** (main.rs L1949, L2680). Treasury IS debited for every block reward. The bootstrap is a virtual grant by design — earned through the debt mechanism, held as non-withdrawable stake until vesting completes. The docs describe this as intentional.

**Doc inconsistencies**: Whitepaper says "1 hour epoch" but code uses 216K slots = 24h. NETWORK_GUIDE says mainnet = 10B MOLT but all other docs say 1B.

---

## What's Clean

| Module | Verdict |
|--------|---------|
| Consensus (staking, epochs, leader selection, voting, slashing) | All correct |
| BFT vote aggregation (66% threshold, Ed25519 verification) | All correct |
| Contributory Stake (50/50 split, debt, graduation) | All correct |
| P2P announcement signature verification (T2.3 fix) | All correct |
| Adaptive heartbeat (400ms/5s cadence) | All correct |
| Mempool priority + MoltyID trust tiers + express lane | All correct |
| EVM integration (REVM, balance bridging, RLP decoding) | All correct |
| Fee burn model (50/30/10/10 split logic) | Correct (double-application is the issue, not the split) |
| Account balance invariants (shells = spendable + staked + locked) | All correct |
| QUIC transport, gossip, peer ban, peer store | All correct |
| RocksDB column families, Merkle tree, state operations | All correct (one batch event bug) |
| Transaction signing + replay protection | All correct |
| Block structure, signing, genesis handling | All correct |
| Sync logic (batch sync, pending blocks) | All correct |
| Rent calculation | All correct |
| ReefStake instructions (deposit, unstake, claim, transfer) | All correct |
| Contract deploy/call/upgrade/close | All correct (except balance loss on close) |

---

## Suggested Fix Priority

**Fix #1 first (state divergence)** — this is the foundational issue. Once received blocks replay transactions, #2 resolves automatically (charge_fee runs once on all nodes, apply_block_effects can then skip the burn/fee-split since charge_fee already did it). Or alternatively, charge_fee deposits the full fee to treasury without splitting, and apply_block_effects handles all distribution — either approach works.

**Then #3 (block validation)** — verify_signature + validate_structure must be called before accepting any P2P block. This also mitigates #8 (fork choice reward theft) and #9 (snapshot poisoning).

**Then #4-#6 (instruction auth + staking)** — these become exploitable once the network has real users.

After those, the remaining findings are medium/low severity and can be addressed in order.

---

*No fixes until you review and approve. Whatever you want to tackle, we tackle.*
