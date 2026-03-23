# Lichen Blockchain Alignment Plan

> Comprehensive plan to align Lichen with real L1 blockchains (Cosmos, Solana, Ethereum, Avalanche).
> Every finding rated by severity. Every fix has a concrete scope. Every phase has a tracker.

**Created:** 2026-03-14
**Status:** CLOSED — All 4 phases implemented (v0.4.0) + Phase 5 hardening (v0.4.5). Remaining follow-up is public-document harmonization, not protocol implementation debt.
**Decision:** Supply model Option B validated on 2026-03-14. All 39 findings resolved. Deployed to testnet 2026-03-17. Production hardening (epoch-frozen validator sets, DeregisterValidator, commit cert cross-ref) added in v0.4.5.

**Closure note (2026-03-20):** Any future-looking notes in this document refer to post-alignment follow-on workstreams such as the standards audit, contract-platform unification, IBC research, or public-doc cleanup. They are not open blockers against this plan's closed implementation status. Operators should note that explorers and RPC may show projected current-epoch rewards and supply before epoch-boundary minting finalizes on-chain `total_minted` and settled supply.

---

## Table of Contents

1. [The Supply Model Decision](#1-the-supply-model-decision)
2. [Findings Summary](#2-findings-summary)
3. [Phase 1 — Critical Fixes](#3-phase-1--critical-fixes)
4. [Phase 2 — High-Priority Fixes](#4-phase-2--high-priority-fixes)
5. [Phase 3 — Medium-Priority Fixes](#5-phase-3--medium-priority-fixes)
6. [Phase 4 — Polish & Standards](#6-phase-4--polish--standards)
7. [Implementation Tracker](#7-implementation-tracker)
8. [Phase 5 — v0.4.5 Production Hardening](#phase-5--v045-production-hardening)

---

## 1. The Supply Model Decision

### The Problem

Lichen historically claimed **"1B LICN, capped-supply, deflationary"** but shipped code that contradicted that narrative:

- The LichenCoin ERC-20 wrapper contract has `mint()` with a **10B** ceiling
- Block rewards come from a pre-funded 100M LICN treasury pool that will deplete
- 40% of all fees are **permanently burned** from a non-replenishable supply
- When the treasury runs dry, block rewards silently stop — validators earn nothing
- MossStake generates yield from redistribution, contradicting "fixed" narrative

Every major PoS chain handles supply differently:

| Chain | Model | Inflation | Burn | Net Effect |
|-------|-------|-----------|------|------------|
| **Ethereum** | Inflationary + burn | ~0.5%/yr issuance | EIP-1559 base fee burn | Net deflationary when busy, slight inflation when quiet |
| **Solana** | Inflationary + burn | Started 8%, decays to 1.5% | 50% fees burned | Net inflationary, decreasing |
| **Cosmos** | Inflationary | 7–20% dynamic (targets 67% bonded) | None protocol-level | Inflationary |
| **Avalanche** | Fixed cap (720M) | None | 100% fees burned | Deflationary, rewards from fixed pool |
| **Bitcoin** | Fixed cap (21M) | Halvings every 4 years | None | Disinflationary, converges to 0 |

### Three Options

#### Option A: Keep Capped-Supply Narrative (Avalanche Model)

**How it works today:** 1B LICN at genesis. 100M in reward pool. 20% annual decay on block rewards. 40% fee burn.

**Core problem:** The burn is permanent destruction from a fixed pie. Long-term, this creates a deflationary death spiral — less circulating supply means less economic activity, which means less fees, which means validators earn less, which means fewer validators, which means less security.

**How to fix it and keep a capped-supply model:**

1. **Stop burning permanently.** Redirect the 40% "burn" into a **Reward Recycling Pool** instead of destroying it. Fees become the long-term source of validator income, replacing the depleting genesis pool.
2. **Cap the LichenCoin contract at 1B** (match the marketing). Remove the 10B ceiling entirely.
3. **New fee split:**

   | Destination | Current | Proposed |
   |-------------|---------|----------|
   | Permanent burn | 40% | **0%** |
   | Reward Recycling Pool | 0% | **30%** |
   | Block producer | 30% | **30%** |
   | Voters | 10% | **10%** |
   | Community treasury | 10% | **15%** |
   | Protocol reserve | 10% | **15%** |

4. **Reward source priority:** Block rewards draw from `Reward Pool` first, then `Recycled Fees Pool` when genesis pool depletes. This creates a sustainable circular economy.

**Pros:**
- No marketing change needed ("fixed 1B supply" stays true)
- Simpler narrative for non-technical audiences
- Supply only ever decreases (if any voluntary burn mechanisms exist)

**Cons:**
- Without permanent burn, there's no deflationary pressure — token price relies entirely on demand
- If network usage drops, recycled fees can't cover reward obligations
- Avalanche has the same problem and compensates with C-chain EVM gas fees at scale — Lichen doesn't have that volume yet
- Bootstrap grant economics remain front-loaded (200 validators × 100K = 20M of 100M day one)

#### Option B: Move to Inflationary Supply (Ethereum/Solana Model) — RECOMMENDED

**How it works:** Keep 500M LICN at genesis as the starting supply. Block rewards are **minted fresh** (not drawn from a pool). Fee burn acts as deflationary counter-pressure. Net supply can go up or down based on network activity.

**Detailed design:**

1. **Genesis:** 500M LICN distributed exactly as today (same 6 wallets, same allocation %)
2. **Block rewards:** Minted on the fly — treasury pool is no longer needed as reward source
3. **Target inflation:** Start at **4% annually** (~20M LICN/year at genesis supply), decaying 15% per year:

   | Year | Inflation Rate | New LICN Minted | Cumulative Supply |
   |------|---------------|-----------------|-------------------|
   | 0 | 4.00% | 20.0M | 520M |
   | 1 | 3.40% | 17.7M | 538M |
   | 2 | 2.89% | 15.5M | 553M |
   | 3 | 2.46% | 13.6M | 567M |
   | 5 | 1.77% | 10.3M | 590M |
   | 10 | 0.89% | 5.6M | 628M |
   | 20 | 0.22% | 1.5M | 658M |

4. **Fee burn:** Keep 40% burn. When network is busy, burn > mint = **net deflationary** (like Ethereum). When quiet, mint > burn = slight inflation that pays validators.
5. **Fee split (of remaining 60%):**

   | Destination | Percentage |
   |-------------|------------|
   | Block producer | 30% |
   | Voters | 10% |
   | Community treasury | 10% |
   | Protocol reserve | 10% |

6. **LichenCoin contract:** Remove `mint()` entirely or gate it to governance-only. The WASM wrapper should only reflect native supply 1:1.
7. **Treasury pool:** The existing 100M becomes a **strategic reserve**, not a reward source. It can fund ecosystem grants, bootstrap liquidity, or be governed by LichenDAO. It never depletes from block rewards.
8. **MossStake yield:** Now has a sustainable source — staking yield comes from freshly minted rewards, not redistribution from a finite pool. The narrative is clean: "stake to earn inflation rewards."

**Implementation (what changes in code):**

```
core/src/consensus.rs:
  - Remove: REWARD_POOL_LICN constant
  - Add: INITIAL_INFLATION_RATE_BPS = 400 (4%)
  - Add: INFLATION_DECAY_BPS = 1500 (15% annual decay)
  - Add: TERMINAL_INFLATION_RATE_BPS = 15 (0.15% floor)
  - Modify: decayed_reward() → compute_block_reward() using inflation curve

core/src/state.rs:
  - Add: total_minted counter (alongside total_burned)
  - Modify: get_metrics() → report total_supply = genesis + minted - burned
  - Remove: INITIAL_SUPPLY_SPORES constant (supply is dynamic now)

validator/src/main.rs:
  - Remove: treasury balance check before rewarding
  - Add: mint_block_reward() that creates new spores (not transfers from treasury)
  - Block production: mint reward directly to producer account + voter accounts

core/src/processor.rs:
  - No change to fee charging/burning (stays the same)
  - Fee burn counter still tracks permanent destruction

contracts/lichencoin/src/lib.rs:\n  - Remove MAX_SUPPLY ceiling entirely (supply managed at protocol layer)\n  - LichenCoin WASM wrapper reflects native supply 1:1
```

**Pros:**
- Matches every successful PoS chain (Ethereum, Solana, Cosmos)
- Validators always earn rewards — never silent failures
- Burn creates natural equilibrium (high usage → deflationary, low usage → slight inflation)
- MossStake yield has an honest source
- No depleting pool, no front-loading risk
- Clean narrative: "inflationary rewards offset by burn, targeting net-zero at scale"

**Cons:**
- Requires changing marketing from "capped supply" to "adaptive supply with burn"
- Some crypto audiences allergic to the word "inflation" (though Ethereum proved this is fine)
- Slightly more complex economics to explain

#### Option C: Hybrid — Fixed Genesis + Governance-Gated Mint

Keep a 1B capped-supply narrative as default, but allow LichenDAO governance to vote on minting additional supply if the reward pool ever depletes. This is the "emergency valve" approach.

**Pros:** Markets as capped supply, has an escape hatch.
**Cons:** Creates uncertainty. "Is it really fixed if governance can mint?" — worst of both worlds for credibility.

**Not recommended.**

### Recommendation: Option B (Inflationary)

Every mature PoS chain that succeeded long-term is inflationary with burn as counter-pressure. The fixed-supply model works for Bitcoin (PoW, no staking rewards needed) and has known sustainability concerns for PoS chains (Avalanche is the experiment, and it's too early to call it proven). Ethereum's EIP-1559 model is the most battle-tested.

Lichen as an **agent economy** needs predictable validator economics. Agents won't stake if rewards can silently stop. Option B gives:
- Predictable validator income (always minting)
- Deflationary pressure when the network is busy (40% burn)
- Clean MossStake economics (yield from inflation, not redistribution sleight of hand)
- No depleting pools, no silent failures, no 10B hidden mint cap

The 100M LICN currently allocated as "Validator Rewards Pool" becomes a strategic ecosystem reserve — available for grants, liquidity bootstrapping, or whatever LichenDAO decides. It doesn't need to fund block rewards anymore.

---

## 2. Findings Summary

39 findings across 8 categories, ranked by severity.

| ID | Severity | Category | Finding |
|----|----------|----------|---------|
| C-1 | CRITICAL | Consensus | No light client verification proofs (no commit certificates) |
| C-2 | CRITICAL | Consensus | No block commit signatures in block header (single validator sig only) |
| C-3 | CRITICAL | Consensus | BFT timeouts use linear backoff (should be exponential) |
| C-4 | CRITICAL | Economics | LichenCoin contract has 10B mint cap vs 1B marketing claim |
| C-5 | CRITICAL | State | No general-purpose state proofs for accounts (no light client support) |
| H-1 | HIGH | Consensus | Finality depth (32-slot) confuses Tendermint instant finality claim |
| H-2 | HIGH | Economics | Block rewards silently fail when treasury is empty |
| H-3 | HIGH | Economics | Bootstrap grant economics front-loaded (20M of 100M on day 1) |
| H-4 | HIGH | State | Merkle tree is non-standard binary (not sparse/IAVL/MPT) |
| H-5 | HIGH | State | No account eviction → unbounded state growth |
| H-6 | HIGH | Transactions | Blockhash replay window only 300 blocks (no durable nonce) |
| H-7 | HIGH | Transactions | Transaction hash includes signatures (unpredictable before signing) |
| H-8 | HIGH | P2P | No DHT-based peer discovery (gossip-only, flat broadcast) |
| H-9 | HIGH | P2P | No formal Peer Exchange Protocol |
| H-10 | HIGH | EVM | EVM routing uses sentinel blockhash convention, not cryptographic envelope |
| H-11 | HIGH | Solana | "Solana compatible" label misleading — structural format only |
| H-12 | HIGH | Contracts | Two incompatible dispatch models (named export vs opcode) |
| H-13 | HIGH | Contracts | No cross-contract invocation (CPI) |
| H-14 | HIGH | Features | No IBC / trustless cross-chain protocol |
| H-15 | HIGH | Features | Core chain params are hardcoded, not governance-changeable |
| M-1 | MEDIUM | Consensus | No explicit epoch boundary state transition |
| M-2 | MEDIUM | Economics | MossStake yield contradicts fixed-supply narrative |
| M-3 | MEDIUM | Economics | Fee burn ratio aggressive with no offsetting inflation |
| M-4 | MEDIUM | State | Contract storage limits enforced in app code, not protocol |
| M-5 | MEDIUM | Transactions | No gas metering for native instructions (flat fee for everything) |
| M-6 | MEDIUM | Transactions | First-byte heuristic for payload type detection |
| M-7 | MEDIUM | Transactions | Reputation-based fee discounts create MEV vector |
| M-8 | MEDIUM | Transactions | Express lane in mempool bypasses fee-based ordering |
| M-9 | MEDIUM | P2P | TOFU certificate pinning without rotation |
| M-10 | MEDIUM | P2P | Eclipse defense is /24 subnet only (no AS-level) |
| M-11 | MEDIUM | EVM | Chain ID collision risk (hardcoded 8001, no registry) |
| M-12 | MEDIUM | EVM | Missing EVM features (precompiles, CREATE2, proper eth_getLogs) |
| M-13 | MEDIUM | Contracts | WASM memory limit very low (64KB default, 16MB max) |
| M-14 | MEDIUM | Contracts | No contract upgrade governance (owner-only, no timelock) |
| M-15 | MEDIUM | Features | Non-deterministic block timestamps (wall-clock, not BFT median) |
| M-16 | MEDIUM | Features | No historical state queries (no archive mode) |
| M-17 | MEDIUM | Features | Oracle prices set by single block producer per block |
| M-18 | MEDIUM | Features | No transaction simulation gas estimation |
| M-19 | MEDIUM | Features | No WebSocket heartbeat/keepalive standard |

---

## 3. Phase 1 — Critical Fixes

These are credibility blockers. Any experienced L1 developer who inspects the codebase will flag these.

### 1.1 Supply Model Overhaul

**Scope:** Implement Option B (inflationary supply with burn)

**Changes:**

| File | Change |
|------|--------|
| `core/src/consensus.rs` | Add inflation constants: `INITIAL_INFLATION_RATE_BPS`, `INFLATION_DECAY_BPS`, `TERMINAL_INFLATION_RATE_BPS`. Replace `decayed_reward()` with `compute_block_reward(total_supply, current_slot)`. Remove `REWARD_POOL_LICN` dependency. |
| `core/src/state.rs` | Add `total_minted` counter in CF_STATS. Modify `get_metrics()` to compute total_supply = genesis_supply + total_minted - total_burned. Remove hardcoded `INITIAL_SUPPLY_SPORES`. |
| `validator/src/main.rs` | Replace treasury-fund-check-then-transfer flow with direct mint: create new spores in producer/voter accounts. Remove warning about empty treasury. Drop `REWARD_POOL_LICN` constant. |
| `contracts/lichencoin/src/lib.rs` | Remove MAX_SUPPLY ceiling entirely (supply is managed at protocol layer). Remove the misleading audit-fix comment about "marketing refers to native layer." |
| `core/src/processor.rs` | No fee logic changes. Burn stays at 40%. |
| `rpc/src/lib.rs` | Update `getChainStatus` / `getMetrics` to report `total_minted`, `total_burned`, `circulating_supply`, `inflation_rate`. |
| Genesis | The existing 100M "Validator Rewards Pool" wallet becomes "Protocol Reserve." No longer the reward source. |

**Acceptance criteria:**
- Block rewards are minted, not transferred from treasury
- `total_supply` reported via RPC = genesis + minted - burned
- Inflation rate starts at 4%, decays 15% annually, floors at 0.15%
- Fee burn still destroys 40% permanently
- LichenCoin contract MAX_SUPPLY ceiling removed (supply managed at protocol layer)
- All existing tests pass with updated economics

---

### 1.2 Block Commit Certificates (C-1, C-2)

Store 2/3+ validator precommit signatures in the block header so finality is provable.

**Changes:**

| File | Change |
|------|--------|
| `core/src/block.rs` | Add `commit_signatures: Vec<CommitSignature>` to `Block` (not `BlockHeader` — keeps header lightweight). Each entry: `{ validator: [u8; 32], signature: [u8; 64] }`. |
| `validator/src/consensus.rs` | After collecting 2/3+ precommits, attach them to the block before broadcasting. |
| `core/src/block.rs` | Add `verify_commit(validator_set, required_stake_fraction)` method that checks commit signatures sum to ≥2/3 stake. |
| `rpc/src/lib.rs` | Expose commit signatures in `getBlock` response. Add `getBlockCommit(slot)` RPC method. |
| `p2p/src/message.rs` | Include commit signatures in Block propagation messages. |

**Acceptance criteria:**
- Every block (except genesis) carries commit signatures from ≥2/3 stake
- `verify_commit()` returns true for valid blocks, false otherwise
- RPC exposes commit data
- Light clients can verify finality by checking commit signatures

---

### 1.3 Account State Proofs (C-5)

Implement Merkle inclusion proofs so any account's state can be verified against the state root.

**Changes:**

| File | Change |
|------|--------|
| `core/src/state.rs` | Maintain the ordered Merkle leaf set and support per-account inclusion proofs from cached account leaves. |
| `core/src/state.rs` | Add `get_account_proof(pubkey) → MerkleProof` that returns siblings + path for verification. |
| `core/src/state.rs` | Add `verify_account_proof(root, pubkey, account, proof) → bool`. |
| `rpc/src/lib.rs` | Add `getAccountProof(pubkey)` RPC method returning an anchored inclusion proof plus block context. |

**Alternatives considered:**
- IAVL+ tree (Cosmos) — good but adds a dependency, complex
- Merkle-Patricia Trie (Ethereum) — overkill for non-EVM account model
- **Sparse Merkle Tree** — possible future enhancement for stronger authenticated-state and non-existence semantics beyond this plan's closure scope

**Acceptance criteria:**
- Any account can produce a proof verifiable against the block's state_root
- Proof size is O(log N) where N = number of accounts
- RPC exposes anchored proof generation

**Follow-up note (2026-03-20):**
Task 1.3 closed on anchored inclusion proofs for existing accounts. Post-plan audit work later tightened proof anchoring and validator-set commitment, but SMT-style non-existence proofs remain a separate future enhancement rather than an open blocker in this plan.

---

### 1.4 Fix BFT Timeout Backoff (C-3)

Switch from linear to exponential timeout backoff.

**Changes:**

| File | Change |
|------|--------|
| `validator/src/consensus.rs` | Change timeout calculation from `base_ms * (round + 1)` to `base_ms * timeout_delta.pow(round)` with reasonable delta (1.5x) and max cap (60 seconds). |

**Acceptance criteria:**
- Round 0: 2s, Round 1: 3s, Round 2: 4.5s, Round 3: 6.75s ... capped at 60s
- Consensus still converges under normal conditions
- Stall recovery is faster than linear due to backoff ceiling

---

### 1.5 Fix LichenCoin Mint Cap (C-4)

**Part of 1.1** — MAX_SUPPLY ceiling removed entirely. Supply is managed at the protocol layer via inflation constants.

---

## 4. Phase 2 — High-Priority Fixes

These undermine professional trust when discovered by developers building on Lichen.

### 2.1 Silent Reward Failure → Emit Event (H-2)

**Resolved by 1.1** — inflationary model eliminates treasury depletion. Block rewards always available via minting.

---

### 2.2 Bootstrap Grant Economics (H-3)

**RESOLVED** — The existing bootstrap debt repayment system already prevents dump-and-leave:
1. 100K LICN goes directly to `staked` balance (not `spendable`)
2. `bootstrap_debt` of 100B spores must be repaid via reward splitting (50%/75%/90% to debt)
3. 18-month time cap (`MAX_BOOTSTRAP_SLOTS = 27,648,000`) for automatic graduation
4. `BootstrapStatus::Bootstrapping` → `FullyVested` tracks graduation state
5. First 200 validators only, with hardware fingerprint uniqueness check

No additional vesting needed — the contributory stake model is stronger than simple time-lock vesting.

---

### 2.3 Improve Merkle Tree (H-4)

**Resolved by 1.3** — SMT implementation replaces flat binary tree.

---

### 2.4 State Growth Management (H-5) — DONE

| File | Change |
|------|--------|
| `core/src/account.rs` | Added `dormant: bool` and `missed_rent_epochs: u64` fields to Account struct with `#[serde(default)]` for backward compatibility. |
| `core/src/processor.rs` | Rewrote `apply_rent()` from monthly flat-rate to epoch-based graduated system. Added `compute_graduated_rent()` free function with tiered pricing. Added `RENT_FREE_BYTES` (2KB) and `DORMANCY_THRESHOLD_EPOCHS` (2) constants. |
| `core/src/state.rs` | Added `deserialize_account_check_dormant()` helper. Modified all three state root computation paths (incremental, cold start, full scan) to exclude dormant accounts from Merkle tree. Added reactivation logic to both `StateStore::transfer()` and `StateBatch::transfer()` — dormant accounts are automatically reactivated when receiving funds. |
| `core/src/lib.rs` | Exported `compute_graduated_rent`, `RENT_FREE_BYTES`, `DORMANCY_THRESHOLD_EPOCHS`. |

**Design details:**
- **Graduated rent tiers** (billable = data_len - 2KB free threshold):
  - 0–2KB data: FREE (exempt)
  - 2KB–10KB (8KB billable): 1× rate per KB per epoch
  - 10KB–100KB (next 90KB): 2× rate per KB per epoch
  - 100KB+ (excess): 4× rate per KB per epoch
- **Epoch-based billing**: Monthly rate is converted to per-epoch rate via `rate × SLOTS_PER_EPOCH / SLOTS_PER_MONTH`
- **Missed payment tracking**: If rent cannot be fully paid, `missed_rent_epochs` accumulates. After ≥ 2 consecutive missed epochs, account becomes dormant.
- **Dormancy**: Dormant accounts remain in storage but are excluded from the active state Merkle root, reducing state pressure.
- **Reactivation**: Any transfer TO a dormant account clears `dormant` and `missed_rent_epochs`, re-including it in the state root.
- **No data loss**: Dormant accounts are never deleted. This is a deliberate design decision to prevent involuntary data loss.

**Tests added (11):**
- 6 graduated rent tests: below free tier, tier 1, tier 2, tier 3, partial KB, zero rate
- 5 dormancy tests: state root exclusion, transfer reactivation, state root re-inclusion after reactivation, batch transfer reactivation, deserialize check helper

**Acceptance criteria:** ✅ All met
- ✅ State growth bounded by rent economics (graduated per-epoch rent)
- ✅ No involuntary data loss (dormancy, not deletion)
- ✅ Dormant accounts can be reactivated (by receiving funds)

---

### 2.5 Durable Nonce for Long-Lived Transactions (H-6)

| File | Change |
|------|--------|
| `core/src/processor.rs` | Add system instruction type 28: `AdvanceNonce`. Creates a nonce account with a stored blockhash that only advances when explicitly told to. Transactions referencing a nonce account's stored hash remain valid indefinitely until the nonce is advanced. |

Mirrors Solana's durable nonce mechanism exactly.

---

### 2.6 EVM Transaction Envelope (H-10)

| File | Change |
|------|--------|
| `core/src/processor.rs` | Add explicit `TransactionType` enum: `Native`, `Evm`, `SolanaCompat`. Replace sentinel blockhash detection with typed enum in the `Transaction` struct. |
| `core/src/evm.rs` | EVM transactions carry their ECDSA signature in a proper field, not instruction data. |

---

### 2.7 Rename Solana Compat Endpoint (H-11)

| File | Change |
|------|--------|
| `rpc/src/lib.rs` | Rename `/solana` to `/solana-compat` or `/solana-format`. Update all documentation to say "Solana-format RPC" not "Solana-compatible." |
| Documentation | Clearly state: "Accepts Lichen transactions in Solana wire format. Does not accept native Solana transactions." |

---

### 2.8 Unify Contract Dispatch (H-12)

| File | Change |
|------|--------|
| Long-term | Migrate 7 DEX opcode contracts to named-export style. Ship a compatibility shim that translates opcode calls to named exports during transition period. |
| Short-term | Document both patterns clearly with rationale in developer portal. |

---

### 2.9 Cross-Contract Invocation (H-13)

| File | Change |
|------|--------|
| `core/src/contract.rs` | Add host function `host_call_contract(contract_addr, function_name, args) → result`. Executes target contract within same transaction context. Re-entrancy guard prevents infinite loops. Call depth limit: 8. |
| `sdk/src/lib.rs` | Add `call_contract()` to contract SDK so WASM contracts can invoke other contracts. |

**Acceptance criteria:**
- Contract A can call Contract B within a single transaction
- State changes are atomic (all or nothing)
- Call depth capped at 8
- Re-entrancy protected

---

### 2.10 DHT Peer Discovery (H-8, H-9)

| File | Change |
|------|--------|
| `p2p/src/gossip.rs` | Implement Kademlia DHT for peer discovery alongside existing gossip. Use DHT for initial peer finding, gossip for block/vote propagation. |
| `p2p/src/network.rs` | Add Peer Exchange (PEX) protocol: on connection, exchange known peer lists. |

---

### 2.11 Governance Parameter Changes (H-15)

| File | Change |
|------|--------|
| `core/src/processor.rs` | Add system instruction type 29: `GovernanceParamChange`. LichenDAO proposals can change: `base_fee`, `fee_split_percentages`, `min_validator_stake`, `epoch_length`. Changes take effect at next epoch boundary. |
| `core/src/genesis.rs` | Store consensus params in state (mutable) instead of only in genesis config. |

---

## 5. Phase 3 — Medium-Priority Fixes

### 3.1 Explicit Epoch Boundary Logic (M-1)

Add `process_epoch_boundary(slot)` that runs at every `slot % EPOCH_SLOTS == 0`:
- Snapshot validator set for next epoch
- Compute and distribute epoch-level metrics
- Apply pending governance parameter changes
- Emit epoch event via WebSocket

### 3.2 Compute Metering for Native Instructions (M-5)

Assign compute-unit costs to each native instruction type:
- Transfer: 100 CU
- Stake/Unstake: 500 CU
- NFT Mint: 1,000 CU
- ZK Shield: 100,000 CU
- ZK Transfer: 200,000 CU

Base fee scales with CU consumption rather than being flat.

### 3.3 Deterministic Block Timestamps (M-15)

Use BFT-committed timestamps: median of prevote timestamps from validators in the commit. Matches CometBFT behavior.

### 3.4 Contract Upgrade Governance (M-14)

Add optional timelock to contract upgrades. Contracts can opt-in to N-epoch delay between upgrade submission and execution. During delay, any LichenDAO veto cancels the upgrade.

### 3.5 Improved EVM Compatibility (M-12)

- Add precompile contracts: ecRecover, SHA-256, RIPEMD-160, identity, modexp
- Implement proper `eth_getLogs` with topic filtering
- Register chain ID 8001 on Chainlist

### 3.6 WASM Memory Limits (M-13) — DONE

**Problem**: Previous max of 256 pages (16MB) was restrictive for complex contracts (e.g., DEX AMM, ZK verification). No guaranteed minimum caused some contracts to start with 0 pages.

**Implementation**:
- `MAX_WASM_MEMORY_PAGES`: 256 → 1024 (64MB max). Comparable to Solana (heap 32KB + stack, but Programs v2 plans larger), CosmWasm (512MB cap), and Near (1GB theoretical).
- `DEFAULT_WASM_MEMORY_PAGES`: New constant = 16 (1MB). After contract instantiation, if declared memory < 16 pages, runtime grows to 16 pages automatically.
- Both constants exported from `lichen-core` for SDK/tooling use.
- Three validation points: deploy checks initial+max ≤ 1024, instantiation ensures ≥ 16 pages, post-execution validates ≤ 1024.
- Memory growth is silent (`let _ = memory.grow()`) — contracts declaring a maximum below 16 pages keep their declared max.

**Files**: `core/src/contract.rs` (constants, deploy validation, runtime growth), `core/src/lib.rs` (exports).
**Tests**: 7 new tests — constant verification, size math, deploy rejection (over-max initial + over-max declared), deploy acceptance (at-max, small, default). Helpers: `wasm_with_memory(min, max)` generates valid WASM binary with specified memory section.

### 3.7 Oracle Multi-Source Attestation (M-17) — DONE

Require N/M validator attestation for oracle prices instead of single block producer authority.

**Problem**: Oracle prices were set by a single block producer per block. A malicious validator could manipulate price feeds unilaterally, affecting DeFi protocols (ThallLend liquidations, DEX pricing, SporePump bonding curves).

**Solution**: Native system instruction (type 30) for oracle price attestation at the core protocol level. Active validators submit price readings for named assets. When >2/3 of active stake has attested (Tendermint-style strict supermajority), a stake-weighted median price is computed and stored as the consensus price.

**Design**:
- **System instruction type 30**: `OracleAttestation` — validators submit `[30, asset_len, asset_bytes..., price_u64_le, decimals_u8]`
- **OracleAttestation struct**: `{ validator: Pubkey, price: u64, decimals: u8, stake: u64, slot: u64 }` — stored per validator per asset in CF_STATS
- **OracleConsensusPrice struct**: `{ asset: String, price: u64, decimals: u8, slot: u64, attestation_count: u32 }` — committed when quorum reached
- **Quorum threshold**: Strict >2/3 of total active stake (same as BFT block finality)
- **Price calculation**: Stake-weighted median — identical algorithm to BFT timestamp computation (sort by price, walk cumulative stake, return price where cumulative > half total)
- **Staleness window**: 9,000 slots (~1 hour) — attestations older than this are excluded from quorum checks
- **Asset naming**: 1–16 byte UTF-8 identifiers (e.g., "LICN", "wETH", "wBTC")
- **Validator override**: A validator can update their attestation at any time; latest always wins
- **Multi-asset independence**: Each asset has its own attestation pool and quorum tracking
- **Compute cost**: 500 CU per attestation instruction

**Storage keys (CF_STATS)**:
- `oracle_att_{asset}_{validator_hex}` → JSON OracleAttestation
- `oracle_price_{asset}` → JSON OracleConsensusPrice

**Validation**: Signer must be an active validator (has stake in pool). Price must be >0. Decimals ≤18. Asset name 1–16 bytes, valid UTF-8.

**Files**: `core/src/processor.rs` (constants, instruction dispatch, attestation handler, quorum logic, stake-weighted median), `core/src/state.rs` (4 new oracle storage methods), `core/src/lib.rs` (exports).
**Tests**: 15 new tests — 11 oracle integration tests (basic submit, reject non-validator, reject zero price, reject invalid decimals, reject empty/too-long asset, reject short data, quorum consensus, validator replacement, multi-asset independence, compute units) + 4 stake-weighted median unit tests (single, equal stakes, unequal stakes, empty). Helpers: `make_oracle_attestation_ix()`, `setup_active_validator()`.

### 3.8 Express Lane Removal (M-8) — DONE

Remove reputation express lane from mempool. All transactions ordered by fee only. Reputation can influence fee discounts but not queue priority.

**Problem**: The mempool had an "express lane" — a separate priority queue for Tier 4+ agents (reputation ≥ 5,000). Express lane transactions were drained before the regular queue, guaranteeing block inclusion regardless of fee. Additionally, `effective_priority()` multiplied fees by a reputation-based multiplier (1.0x–3.0x), meaning high-reputation agents could pay lower fees and still get priority. This created an MEV vector and violated fair ordering principles.

**Solution**: Removed the express lane entirely. Changed `effective_priority()` to return raw fee (no reputation multiplier). All transactions are now ordered strictly by fee (highest first), with FIFO tiebreaking for equal fees.

**Changes**:
- **Removed**: `EXPRESS_LANE_MIN_REPUTATION` constant, `express_queue` field from `Mempool` struct, `get_trust_tier` import, `reputation` field from `PrioritizedTransaction`
- **Simplified**: `effective_priority()` → returns `self.fee` directly. `Ord` impl compares fees directly.
- **Simplified**: `get_top_transactions()`, `remove_transaction()`, `remove_transactions_bulk()`, `cleanup_expired()`, `prune_stale_blockhashes()`, `clear()` — all operate on single queue instead of two
- **Validator**: Removed reputation lookups in P2P transaction handler and RPC transaction handler (was `state.get_reputation()` call). Removed unused `state_for_rpc_lookup` and `state_for_p2p_txs` clones.
- **Developer portal**: Updated `lichenid.html` (removed Priority/Express lane references, updated tier table), `architecture.html` (updated mempool description), `changelog.html` (updated feature description)

**Files**: `core/src/mempool.rs` (complete refactor), `validator/src/main.rs` (removed reputation lookup for P2P + RPC tx paths), `developers/lichenid.html`, `developers/architecture.html`, `developers/changelog.html`.
**Tests**: 8 mempool tests (3 replaced: fee_only_ordering, no_express_lane, strict_fee_ordering replace reputation_priority, express_lane, effective_priority). All verify reputation has zero effect on ordering.

### 3.9 WebSocket Keepalive (M-19) — DONE

Add ping/pong at 30-second intervals. Document reconnection behavior.

**Problem**: WebSocket connections had no standardized keepalive. Dead connections could remain open indefinitely, consuming server resources. The existing 15-second ping had no pong timeout detection.

**Solution**: RFC 6455 compliant keepalive at 30-second intervals with strict single-pong timeout. Dead connections are detected and closed within one ping cycle (30s).

**Changes**:
- **`WS_PING_INTERVAL_SECS = 30`**: Named constant for ping interval
- **Pong timeout detection**: `Arc<AtomicBool>` flag tracks whether a pong was received since the last ping. If `pong_pending` is still true when the next ping fires, the connection is closed.
- **Pong clearing**: Main recv loop clears `pong_pending` on receiving a `Message::Pong`
- **JSON ping**: Clients can also send `{"method":"ping"}` and receive `{"result":"pong"}`
- **Documentation**: Updated `developers/ws-reference.html` keepalive section with exact behavior, warning about strict single-pong timeout.

**Files**: `rpc/src/ws.rs` (keepalive logic + 3 tests), `developers/ws-reference.html` (docs update).
**Tests**: 3 new tests — ws_ping_interval_is_30_seconds, ws_pong_pending_flag_lifecycle, ws_pong_timeout_detects_dead_connection.

### 3.10 Historical State Queries / Archive Mode (M-16) — DONE

Write-through archive snapshots: every `put_account` (direct and batch) also writes to `CF_ACCOUNT_SNAPSHOTS` when archive mode is enabled. Snapshots are keyed by `pubkey(32) + slot(8, BE)`, enabling O(1) reverse-seek historical lookups.

**Design details**:
- **Column family**: `CF_ACCOUNT_SNAPSHOTS` with `archival_opts(32)` — Zstd compression, 32-byte pubkey prefix extractor, 32KB blocks, bloom filter.
- **Key format**: `pubkey(32) + slot(8, big-endian)` → bincode-serialized Account (0xBC prefix, same format as CF_ACCOUNTS).
- **Write path — direct**: `StateStore::put_account_with_hint()` checks `is_archive_mode()` and current slot (`get_last_slot()`); if both are valid, writes snapshot alongside the primary CF_ACCOUNTS write.
- **Write path — batch**: `StateBatch` carries an `archive_slot` field set from `get_last_slot()` at `begin_batch()` time. `StateBatch::put_account()` adds snapshot writes to the WriteBatch, committed atomically with all other mutations.
- **Read path**: `get_account_at_slot(pubkey, target_slot)` uses `IteratorMode::From(seek_key, Direction::Reverse)` for O(1) seek to find the latest snapshot at or before `target_slot` with matching pubkey prefix.
- **Pruning**: `prune_account_snapshots(before_slot)` iterates CF and batch-deletes entries older than the cutoff.
- **Metadata**: `get_oldest_snapshot_slot()` returns the earliest available snapshot slot.
- **Toggle**: `set_archive_mode(true/false)` via `Arc<AtomicBool>` (thread-safe, settable at node startup).
- **RPC endpoint**: `getAccountAtSlot(pubkey, slot)` — returns historical account state or error if archive mode is disabled / no snapshot found.

**Files**: `core/src/state.rs` (CF + 5 methods + StateBatch hook + 11 tests), `rpc/src/lib.rs` (route + handler), `rpc/tests/rpc_full_coverage.rs` (4 integration tests).
**Tests**: 11 state-level + 4 RPC integration = 15 new tests, 1,568 total passing.

### 3.11 Payload Type Envelope (M-6)

Replace first-byte heuristic with explicit version/type byte prefix in transaction wire format.

**Problem:** The RPC layer used a first-byte heuristic (`0x7B` = JSON, anything else = bincode) to determine transaction format. This is fragile — a valid bincode payload could start with `{` by coincidence, and there was no way to distinguish Native vs EVM vs SolanaCompat at the wire level.

**Solution: Wire Envelope Format**

All transaction encoders now produce a 4-byte header + bincode payload:

```
Byte 0-1: Magic bytes  [0x4D, 0x54]  ("MT")
Byte 2:   Wire version  0x01
Byte 3:   Type byte     0x00=Native, 0x01=Evm, 0x02=SolanaCompat
Byte 4+:  Bincode payload (Transaction struct)
```

**Backward compatibility:** `Transaction::from_wire()` is a three-format decoder:
1. If first two bytes match `TX_WIRE_MAGIC` → parse V1 envelope (type byte overrides payload `tx_type`)
2. Else try legacy bincode deserialization (bounded, with panic catch_unwind)
3. Else try JSON deserialization (wallet-format JSON with array-of-byte-arrays signatures)

**Encode changes:** `Transaction::to_wire()` replaces `bincode::serialize()` at all encode sites:
- CLI (`cli/src/client.rs`, `cli/src/transaction.rs`, `cli/src/marketplace_demo.rs`) — 10 sites
- Rust SDK (`sdk/rust/src/client.rs`) — 1 site
- Validator (`validator/src/main.rs`) — 1 site
- Custody (`custody/src/main.rs`) — 1 site

**Decode changes:** `decode_transaction_bytes()` in `rpc/src/lib.rs` replaces all 7+ heuristic decode sites:
- `handle_send_transaction`, `simulateTransaction`, `estimateTransactionFee`, `decode_solana_transaction`, `stake`, `unstake`, and `shielded.rs` paths all call the single centralized decoder.

**Files**: `core/src/transaction.rs` (to_wire + from_wire + helpers), `core/src/lib.rs` (exports), `rpc/src/lib.rs` (decode_transaction_bytes replaces 7 sites), `rpc/src/shielded.rs`, `cli/src/client.rs`, `cli/src/transaction.rs`, `cli/src/marketplace_demo.rs`, `sdk/rust/src/client.rs`, `validator/src/main.rs`, `custody/src/main.rs`.
**Tests**: 11 new core wire_format tests (round-trip, backward compat, edge cases) + 3 new RPC integration tests (wire envelope, legacy bincode, simulate). 1,582 total passing.

### 3.12 TOFU Rotation (M-9)

Add certificate rotation mechanism: validators can publish new certificates signed by old ones.

**Problem:** TOFU (Trust On First Use) certificate pinning stores a peer's self-signed certificate fingerprint on first connection. If a validator needs to rotate its TLS certificate (key compromise, scheduled rotation), there was no protocol-level way to do so — the peer would be permanently rejected as an impostor.

**Solution: CertRotation P2P Message**

New `MessageType::CertRotation` gossip message with fields:
- `old_fingerprint: [u8; 32]` — SHA-256 of the certificate being replaced
- `new_fingerprint: [u8; 32]` — SHA-256 of the replacement certificate
- `new_cert_der: Vec<u8>` — DER-encoded new self-signed certificate
- `rotation_proof: Vec<u8>` — reserved for future staking-key attestation
- `timestamp: u64` — Unix epoch seconds of rotation

**Validation flow** (`PeerFingerprintStore::apply_rotation()`):
1. Old fingerprint must match the stored fingerprint for the peer
2. New cert must pass `verify_self_signed_cert()` (structural + signature validity)
3. SHA-256 of `new_cert_der` must equal `new_fingerprint` (no FP/cert mismatch)
4. Rate limit: 1 rotation per `ROTATION_COOLDOWN_SECS` (3,600s = 1 hour) per peer
5. On success: stored fingerprint updated, cooldown timer recorded

**Gossip:** On successful validation, the receiving node re-gossips the CertRotation to all connected peers (same pattern as ValidatorAnnounce). Relay/seed nodes also forward CertRotation messages.

**Local rotation:** `PeerManager::rotate_local_certificate()` generates a new `NodeIdentity` via `load_or_generate_fresh()`, constructs and broadcasts the CertRotation message to all peers.

**Files**: `p2p/src/message.rs` (CertRotation variant), `p2p/src/peer.rs` (apply_rotation, handle_cert_rotation, rotate_local_certificate, last_rotation tracking), `p2p/src/network.rs` (handler + gossip relay).
**Tests**: 6 new tests (accepted, rejected_unknown_peer, rejected_wrong_old_fp, rejected_fp_mismatch_cert, rate_limited, invalid_cert_rejected). 1,595 total passing.

### 3.13 Eclipse Defense (M-10)

Add AS-number diversity check for peer selection (lookup via BGP data or GeoIP ASN).

**Problem:** Eclipse attacks work by surrounding a victim node with attacker-controlled peers. The existing /24 subnet (IPv4) and /48 (IPv6) diversity check prevents trivial same-subnet flooding, but an attacker with IPs across multiple /24 subnets within the same autonomous system (ISP/hosting provider) could still dominate a node's peer table.

**Solution: AS-Level Prefix Bucketing**

Lightweight approximation of ASN diversity without requiring external GeoIP databases:
- `asn_bucket(ip)` computes a u32 bucket from the IP prefix: /16 for IPv4 (first 2 octets), /32 for IPv6 (first 4 bytes)
- `same_asn_bucket(a, b)` returns true if two IPs share the same bucket
- `MAX_PEERS_PER_ASN_BUCKET = 4` — hard cap on peers from the same /16 (IPv4) or /32 (IPv6) prefix
- IPv4 and IPv6 addresses are never in the same bucket (bucketing uses separate ranges)

**Hook:** `connect_peer()` checks ASN bucket count after the existing subnet diversity check. If the bucket is at capacity, the connection is rejected with a logged warning.

**Rationale:** /16 prefix bucketing catches the most common hosting-provider attack pattern (single provider allocates /16 or smaller blocks). True ASN lookup via MaxMind or BGP tables can be added later as an enhancement — the /16 approximation provides immediate defense with zero external dependencies.

**Files**: `p2p/src/peer.rs` (asn_bucket, same_asn_bucket, MAX_PEERS_PER_ASN_BUCKET, count_peers_in_asn_bucket, connect_peer hook).
**Tests**: 7 new tests (ipv4_same_slash16, ipv4_different_slash16, ipv6_same_slash32, ipv6_different_slash32, v4_v6_never_same, deterministic, limit_in_connect_peer). 1,595 total passing.

---

## 6. Phase 4 — Polish & Standards

### 4.1 Transaction Hash Determinism (H-7)

Document that Lichen tx hash = SHA-256(message + signatures). Consider switching to message-only hash for pre-sign prediction.

**Problem:** Transaction hash includes Ed25519 signatures, making it unpredictable before signing. In multi-sig scenarios, not all parties have the txid until all signatures are collected.

**Solution: Dual Hash Exposure**

Lichen keeps the current hash algorithm (matching Bitcoin wtxid and Cosmos `SHA-256(tx_bytes)` convention) but exposes both hashes:

- **`Transaction::hash()`** = `SHA-256(bincode(message) || sig_0 || sig_1 || ...)` — canonical txid, includes signatures for unique deduplication. Stored as `CF_TRANSACTIONS` key.
- **`Transaction::message_hash()`** (NEW) = `SHA-256(bincode(message))` — signing hash, predictable before any signatures are added. Useful for multi-sig coordination and client-side txid tracking.

The RPC `getTransaction` response now includes both `signature` (txid) and `message_hash` fields. Developer docs updated with hash algorithm specification.

**Design rationale:** Switching to message-only txid would enable pre-sign prediction but risks signature-malleability attacks (two parties could submit the same message with different signatures and only one would be accepted). Including signatures prevents this and is the industry standard.

**Determinism guarantee:** Proven via 8 new tests — same tx always produces same hash; different sigs produce different hashes; message_hash is signature-independent; signature order matters.

**Files**: `core/src/transaction.rs` (message_hash method + expanded docs), `rpc/src/lib.rs` (message_hash in tx_to_rpc_json), `developers/rpc-reference.html` (hash field docs).
**Tests**: 8 new core wire_format tests + 1 RPC integration test. 1,613 total passing.

### 4.2 Fee Discount Review (M-7)

Audit reputation fee discounts for MEV vectors. Consider capping max discount or making it apply only after block inclusion.

**Problem:** Reputation-based fee discounts (5–10% off for LichenID reputation 500+) create an MEV vector — searchers with high reputation get a fee advantage over new users for the same operations.

**Audit findings:**
1. No real blockchain (Ethereum, Solana, Bitcoin, Cosmos) uses identity-based fee discounts
2. The discount creates a two-tier fee market favoring established accounts
3. Task 3.7 already removed the express lane (priority queue ordering based on reputation) — the fee discount was the remaining half of the same system
4. Validators indirectly control reputation via block production (+10 rep per block)

**Resolution: Fee discounts REMOVED.** `apply_reputation_fee_discount()` now returns base_fee unchanged (deprecated, kept for backward compat). The `process_transaction` and `simulate_transaction` paths no longer perform reputation lookups for fee calculation. All users pay flat fees. LichenID reputation remains functional for display, trust scoring, and rate limiting — just not for fee advantage.

**Files**: `core/src/processor.rs` (removed discount logic, updated docstrings).
**Tests**: Updated test verifies flat fee behavior.

### 4.3 Contract Storage Protocol Enforcement (M-4)

Move storage size limits from application code into the WASM host function layer.

**Problem:** Contract storage limits were partially enforced at the host function level (key size, value size, entry count) but lacked per-byte compute costs and total storage byte caps. A contract could write 100,000 × 64KB = ~6.4 GB of storage for only 20M CU with no cost proportional to data size.

**Solution: Protocol-level byte enforcement in host functions:**

1. **Per-byte compute cost**: `host_storage_write` now charges `COMPUTE_STORAGE_WRITE (200) + val_len * COMPUTE_STORAGE_WRITE_PER_BYTE (1)`. Writing 64KB costs 200 + 65,536 = 65,736 CU instead of flat 200.

2. **Total storage bytes cap**: `MAX_TOTAL_STORAGE_BYTES = 10 MB (10,485,760 bytes)` per contract. Tracked live via `ContractContext.storage_bytes_used` (initialized from existing storage, updated on every write/delete).

3. **Byte tracking**: `storage_bytes_used` counts key + value bytes. Writes compute delta (new – old for overwrites). Deletes reclaim bytes. Cross-contract call contexts initialize with callee's existing storage bytes.

**Enforcement points:**
- `host_storage_write`: Rejects if `projected_bytes > MAX_TOTAL_STORAGE_BYTES` (returns 0)
- `host_storage_delete`: Reclaims `key.len() + old_val.len()` bytes via saturating subtraction
- `ContractContext::with_storage()` / `with_args()`: Compute initial `storage_bytes_used` from existing HashMap

**Files**: `core/src/contract.rs` (per-byte cost, byte tracking, MAX_TOTAL_STORAGE_BYTES, delete reclaim, CCC context).
**Tests**: 5 new tests (byte tracking new/with_storage/with_args, per-byte cost calculation, constant validation). 1,613 total passing.

### 4.4 Gas Estimation RPC (M-18)

Already implemented in Task 2.14 (`estimateTransactionFee`). Finding resolved.

### 4.5 IBC Exploration (H-14)

Research IBC-lite integration using commit certificates (Phase 1) + account state proofs (Phase 1). Full IBC would require implementing Tendermint light client verification in Lichen and getting listed on Cosmos chain registry.

**Research complete.** Full IBC exploration document at `docs/strategy/IBC_EXPLORATION.md`.

**Summary:**
- Lichen has some of the necessary building blocks: commit certificates (Task 1.2), anchored account inclusion proofs (Task 1.3), BFT commit/finality tracking, deterministic timestamps (Task 3.2)
- Missing: on-chain light client module, ICS-3 connection handshake, ICS-4 channel state machine, ICS-20 token transfer contract, storage-level Merkle proofs
- Recommended approach: IBC-Lite in 4 phases (LC contract → proof relay → ICS-20 → Hermes integration)
- Current LichenBridge provides transitional cross-chain functionality for the current phase. Treasury withdrawals now have live threshold paths on supported Solana/EVM routes, while multi-signer deposit issuance fails closed by default because deposit sweeps still rely on locally derived keys unless an explicit operator override is enabled.
- **Decision: Full IBC deferred.** Task 4.5 is closed as research and scoping; any implementation now belongs to post-alignment follow-on work when ecosystem demand materializes.

---

## 7. Implementation Tracker

### Task 1.1 — Supply Model Overhaul (Option B: Inflationary + Burn)

**Decision:** CONFIRMED — Option B on 2026-03-14.

| # | Sub-task | File(s) | Status |
|---|----------|---------|--------|
| 1.1a | Add inflation constants + `compute_block_reward()` | `core/src/consensus.rs` | DONE |
| 1.1b | Add `total_minted` counter + `get_total_minted()` | `core/src/state.rs` | DONE |
| 1.1c | Add `atomic_mint_accounts()` for minting new spores | `core/src/state.rs` | DONE |
| 1.1d | Update `Metrics` struct (add total_minted, inflation_rate) | `core/src/state.rs` | DONE |
| 1.1e | Update `get_metrics()` supply calculation (genesis + minted - burned) | `core/src/state.rs` | DONE |
| 1.1f | Replace treasury-debit reward pipeline with mint-based rewards | `validator/src/main.rs` | DONE |
| 1.1g | Update MossStake distribution to use minted (not treasury) | `validator/src/main.rs` | DONE |
| 1.1h | Remove `REWARD_POOL_LICN` constant + treasury reward check | `validator/src/main.rs` | DONE |
| 1.1i | Fix LichenCoin `MAX_SUPPLY` docs (ERC-20 wrapper, 10B ceiling kept) | `contracts/lichencoin/src/lib.rs` | DONE |
| 1.1j | Update `core/src/lib.rs` exports (new constants) | `core/src/lib.rs` | DONE |
| 1.1k | Update RPC `getMetrics` + `getChainStatus` (total_minted, inflation_rate) | `rpc/src/lib.rs` | DONE |
| 1.1l | Add supply cards to explorer (Total Supply, Minted, Inflation Rate) | `explorer/index.html`, `explorer/js/explorer.js` | DONE |
| 1.1m | Update marketing: website, SKILL.md, README.md | `website/index.html`, `SKILL.md`, `README.md` | DONE |
| 1.1n | Remove dead code: old decay constants, ANNUAL_REWARD_RATE_BPS | all | DONE |
| 1.1o | `cargo build --release` clean (no warnings) | workspace | DONE |
| 1.1p | `cargo test --workspace --release` all pass (1,396 tests) | workspace | DONE |
| 1.1q | Epoch-based staker rewards (Solana model) | `core/src/consensus.rs`, `validator/src/main.rs` | DONE |
| 1.1r | Update RPC inflation reporting for epoch model | `rpc/src/lib.rs` | DONE |
| 1.1s | Fix production_readiness tests for epoch model | `core/tests/production_readiness.rs` | DONE |
| 1.1t | Fix .lichen domain expiry display (explorer, wallet, extension) | `explorer/js/address.js`, `wallet/js/identity.js`, `wallet/extension/src/popup/popup.js` | DONE |
| 1.1u | Fix developer portal SLOTS_PER_YEAR reference (63M→78.8M) | `developers/contracts.html` | DONE |

#### Design Details (Task 1.1)

**Inflation constants:**
- `INITIAL_INFLATION_RATE_BPS = 400` (4% annually)
- `INFLATION_DECAY_RATE_BPS = 1500` (15% annual decay)
- `TERMINAL_INFLATION_RATE_BPS = 15` (0.15% floor)
- `GENESIS_SUPPLY_SPORES = 500_000_000_000_000_000` (500M LICN)

**Epoch-based reward distribution (Solana model):**

Inflation rewards are distributed at **epoch boundaries** to ALL active stakers proportionally
by stake weight. Block producers earn only transaction fees per-block (30% producer share).
This matches the Solana/Cosmos reward model and scales correctly to 200+ validators.

```
SLOTS_PER_EPOCH = 432,000 (~2 days at 400ms/slot)
epoch_mint = total_supply × inflation_rate_bps × SLOTS_PER_EPOCH / (10000 × SLOTS_PER_YEAR)
```

Year 0: ~109,589 LICN per epoch (~20M LICN/yr ÷ ~182.5 epochs/yr)
Year 1: ~93,101 LICN/epoch
Year 5: ~56,461 LICN/epoch
Year 10: ~28,427 LICN/epoch

**At each epoch boundary:**
1. `compute_epoch_mint(epoch_start, total_supply)` calculates total new spores
2. `distribute_epoch_staker_rewards()` splits proportionally to active stake
3. Each validator's share routes through `add_reward()` → `claim_rewards()` vesting pipeline
4. MossStake receives 10% of epoch mint (MOSSSTAKE_BLOCK_SHARE_BPS = 1000)
5. Remaining 90% distributed to stakers by stake weight

**Per-block:** `distribute_block_reward()` returns 0 (tracking only). Block producers earn
transaction fees (30% producer, 10% voters, 10% treasury, 10% community, 40% burned).

**Operator note:** Before an epoch boundary, RPC and explorer surfaces may show `projected_pending`, `projected_epoch_reward`, and projected supply values derived from the current epoch schedule. Those are informational estimates only. Canonical minted supply and newly settled staking rewards advance when the epoch boundary executes.

**Fee burn stays at 40%** — this is the deflationary counter-pressure.
When burn > mint: net deflationary. When mint > burn: slight inflation.

**Bootstrap grants:** UNCHANGED. Still funded from the 100M genesis treasury reserve.
The treasury is no longer depleted by block rewards, only by bootstrap grants (max 20M for 200 validators).

**Supply tracking:**
```
total_supply = GENESIS_SUPPLY + total_minted - total_burned
circulating = total_supply - locked_in_staking - genesis_wallets - treasury
```

### Task 1.2 — Block Commit Certificates (C-1, C-2)

**Status:** DONE

**Problem:** Blocks carried only a single producer signature — no proof that 2/3+ validators
agreed. Light clients had no way to verify finality without trusting the proposer.

**Solution:** Each committed block now carries an array of `CommitSignature` from the precommit
round. The consensus engine retains precommit signatures and attaches them to the block at commit time.

**CommitSignature struct** (`core/src/block.rs`):
```rust
pub struct CommitSignature {
    pub validator: [u8; 32],  // Ed25519 pubkey
    pub signature: [u8; 64],  // Ed25519 signature over Precommit::signable_bytes(height, round, &Some(block_hash))
}
```

**Block.verify_commit(round, validator_set, stake_pool) → bool:**
- Skips genesis (slot 0)
- Verifies each commit signature against pubkey via Ed25519
- Deduplicates validators, skips non-members and bad signatures
- Checks `committed_stake * 3 >= total_stake * 2` (2/3+ supermajority)

**Consensus engine changes:**
- `precommit_sigs: HashMap<(u32, Pubkey), [u8; 64]>` retains raw signatures alongside votes
- `collect_commit_signatures(round, block_hash) → Vec<CommitSignature>` gathers sigs at commit time
- Both CommitBlock creation sites (on_precommit + do_precommit) attach signatures before returning

**P2P propagation:** `CompactBlock` carries `commit_signatures` (with `#[serde(default)]` for backward compat).

**RPC endpoints:**
- `getBlock` now includes `commit_signatures` and `commit_validator_count` in response
- New `getBlockCommit` endpoint returns `{ slot, block_hash, commit_signatures[], commit_validator_count }`

**Files modified:** `core/src/block.rs`, `core/src/lib.rs`, `validator/src/consensus.rs`,
`validator/src/main.rs`, `p2p/src/message.rs`, `rpc/src/lib.rs`, `core/tests/adversarial_test.rs`

**Tests:** 10 new tests (7 block + 3 consensus). 1,416 total workspace tests passing.

### Task 1.4 — Exponential BFT Timeout Backoff (C-3)

**Status:** DONE

Timeout backoff changed from linear to exponential: `base × 1.5^round`, capped at 60s.

### Task 1.3 — Merkle Proofs + Account State Proofs (C-5, H-4)

**Status:** DONE

**Problem:** No way to prove an account's state against the block's state root. Light clients
couldn't verify account balances without trusting the RPC node.

**Solution:** Added `MerkleProof` and `AccountProof` types with proof generation and verification.
The existing sorted-leaf binary Merkle tree is reused with a new `build_merkle_tree()` that retains
all tree levels for O(log N) proof generation.

**MerkleProof struct** (`core/src/state.rs`):
```rust
pub struct MerkleProof {
    pub leaf_hash: Hash,      // SHA256(pubkey || account_bytes)
    pub siblings: Vec<Hash>,  // Sibling hashes from leaf to root
    pub path: Vec<bool>,      // true = proven node is left child at that level
}
```

**Key methods:**
- `MerkleProof::verify(expected_root) → bool` — recomputes root from leaf + siblings
- `MerkleProof::verify_account(root, pubkey, account_data) → bool` — full verification from raw data
- `StateStore::get_account_proof(pubkey) → Option<AccountProof>` — generates proof from leaf cache
- `StateStore::verify_account_proof(root, pubkey, data, proof) → bool` — standalone verification

**RPC endpoint:** `getAccountProof(pubkey)` returns `{ pubkey, account, proof: { leaf_hash, siblings, path }, state_root }`.

**Files modified:** `core/src/state.rs`, `core/src/lib.rs`, `rpc/src/lib.rs`

**Tests:** 15 new tests (tree building, proof generation, verification, serde, integration, state changes).

### Phase 1 — Other Critical Fixes

| # | Task | Finding | Status |
|---|------|---------|--------|
| 1.2 | Block commit certificates | C-1, C-2 | DONE |
| 1.3 | Sparse Merkle Tree + account state proofs | C-5, H-4 | DONE |
| 1.4 | Exponential BFT timeout backoff | C-3 | DONE |

### Phase 2 — High Priority

### Task 2.4 — State Growth Management / Dormancy Rent (H-5)

**Status:** DONE

**Problem:** No rent collection — accounts persist forever with zero cost, risking unbounded state growth.

**Solution:** Epoch-based graduated rent with dormancy tracking (no eviction).

**Rent tiers** (computed in `compute_graduated_rent`):
- ≤2048 bytes (free threshold): 0 rent
- 2048–10KB: 1× base rate (5000 spores/byte/epoch)
- 10KB–50KB: 2× base rate
- >50KB: 4× base rate

**Dormancy system:**
- Account fields: `dormant: bool`, `missed_rent_epochs: u8`
- If rent owed > balance: `missed_rent_epochs` incremented
- 2 consecutive missed epochs → `dormant = true`
- Dormant accounts persist in storage but excluded from state root calculation
- Receiving a transfer reactivates: `dormant = false`, `missed_rent_epochs = 0`

**Files modified:** `core/src/account.rs`, `core/src/processor.rs`, `core/src/state.rs`,
plus test files for Account struct literal updates.

**Tests:** 11 new tests (6 graduated rent + 5 dormancy/state-root exclusion).

### Task 2.5 — Durable Nonce System (H-6)

**Status:** DONE

**Problem:** Transactions expired after ~30 blocks (~12 seconds). No way to pre-sign transactions
for offline or multi-sig scenarios (Solana finding H-6).

**Solution:** System instruction type 28 with 4 sub-opcodes for durable nonce management.

**NonceState** (stored in account `data`, bincode serialized):
```rust
pub struct NonceState {
    pub authority: Pubkey,      // Who can advance/withdraw/authorize
    pub blockhash: Hash,        // Stored durable blockhash
    pub fee_calculator: u64,    // Fee at time of creation
}
```

**Sub-opcodes (type 28):**
| Sub | Operation | Accounts | Description |
|-----|-----------|----------|-------------|
| 0 | Initialize | `[funder, nonce_account]` | Create nonce account, store current blockhash |
| 1 | Advance | `[authority, nonce_account]` | Update stored blockhash to latest (consumes nonce) |
| 2 | Withdraw | `[authority, nonce_account, recipient]` | Withdraw spores from nonce account |
| 3 | Authorize | `[authority, nonce_account]` | Change authority (new authority in data[33..65]) |

**Durable transaction flow:**
1. Client creates tx with `recent_blockhash = nonce_account.stored_blockhash`
2. First instruction is AdvanceNonce (type 28, sub 1)
3. Blockhash validation: if not recent, checks if first instruction is nonce advance referencing
   a nonce account whose stored blockhash matches → valid (nonce consumed by advance instruction)
4. Both `process_transaction_inner` and simulation path support durable nonce check

**Constants:** `NONCE_ACCOUNT_SIZE = 104` bytes, `NONCE_ACCOUNT_RENT = 104 × 5000 = 520_000` spores

**Files modified:** `core/src/processor.rs`, `core/src/lib.rs`

**Tests:** 9 new tests (initialize, reject existing, insufficient funds, advance, reject same hash,
withdraw, authorize, reject zero authority, unknown sub-opcode). 1,453 total workspace tests passing.

### Task 2.6 — EVM Transaction Envelope Type (H-10)

**Status:** DONE

**Problem:** EVM transactions were detected by a sentinel blockhash (`Hash([0xEE; 32])`) — a brittle
magic-value approach. No typed distinction between native, EVM, and Solana-compat transactions.

**Solution:** Added `TransactionType` enum to the `Transaction` struct for explicit type discrimination.

**TransactionType enum:**
```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum TransactionType {
    #[default]
    Native,       // Standard Lichen transaction (Ed25519)
    Evm,          // EVM-wrapped transaction (ECDSA, EVM nonce replay protection)
    SolanaCompat, // Submitted via Solana-format RPC (tagged for metrics)
}
```

**Key design decisions:**
- `tx_type` field added to `Transaction` with `#[serde(default)]` for JSON backward compat
- `Transaction::is_evm()` checks BOTH `tx_type == Evm` AND legacy sentinel `Hash([0xEE; 32])`
  for backward compatibility with pre-existing transactions
- `Transaction::new_evm(message)` constructor for clean EVM transaction creation
- `Transaction::is_solana_compat()` method for future metrics tagging
- Wire format updated: bincode encodes `tx_type` as u32 LE variant index (4 extra bytes)
- Golden vectors and SDK wire format tests updated accordingly

**Detection flow (processor):**
```
Before: if tx.message.recent_blockhash == EVM_SENTINEL_BLOCKHASH { process_evm... }
After:  if tx.is_evm() { process_evm... }  // checks enum OR legacy sentinel
```

**RPC changes:**
- `eth_sendRawTransaction` uses `Transaction::new_evm(message)` instead of manual struct
- Native `sendTransaction` uses `tx.is_evm()` for routing
- Solana-compat `sendTransaction` uses `tx.is_evm()` for routing

**Files modified:** `core/src/transaction.rs`, `core/src/lib.rs`, `core/src/processor.rs`,
`core/src/mempool.rs`, `rpc/src/lib.rs`, `validator/src/main.rs`, `cli/src/client.rs`,
`cli/src/marketplace_demo.rs`, `cli/src/transaction.rs`, `sdk/rust/src/transaction.rs`,
`core/tests/wire_format.rs`, `core/tests/*.rs`, `rpc/tests/rpc_full_coverage.rs`

**Tests:** All golden vector and wire format tests updated. 1,453 total workspace tests passing.

### Task 2.7 — Rename Solana Compat Endpoint (H-11)

**Status:** DONE

**Problem:** The `/solana` endpoint label implied full Solana compatibility. In reality, it only
accepts Lichen transactions in Solana wire format — native Solana transactions are not supported.

**Solution:**
- Canonical endpoint renamed from `/solana` to `/solana-compat`
- Legacy `/solana` alias kept for backward compatibility (same handler)
- All tests updated to use `/solana-compat`; new test verifies `/solana` alias still works
- Documentation updated across SKILL.md, copilot-instructions.md, developer portal, RPC guide, audit docs
- Clear disclaimer: "Accepts Lichen transactions in Solana wire format. Does not accept native Solana transactions."

**Files modified:** `rpc/src/lib.rs` (route), `rpc/tests/compat_routes.rs` (new alias test),
`rpc/tests/rpc_full_coverage.rs`, `rpc/tests/rpc_handlers.rs`, `SKILL.md`,
`.github/copilot-instructions.md`, `developers/rpc-reference.html`,
`docs/guides/RPC_API_REFERENCE.md`, `docs/guides/CUSTODY_PLAN.md`,
`docs/audits/production_final/DEVPORTAL_AUDIT.md`

**Tests:** 1,454 total workspace tests passing (1 new alias test).

### Task 2.8 — Document Contract Dispatch Patterns (H-12)

**Status:** DONE (documentation deliverable complete; broader opcode migration moved to follow-on platform-unification work)

**Problem:** Two incompatible contract ABI patterns exist: named exports (23 contracts) and opcode
dispatch (8 contracts). Developers need clear guidance on which to use and why.

**Solution (short-term):** Enhanced developer portal contract-reference.html with:
- Clear recommendation: "Use named exports for new contracts"
- Rationale: better tooling, clearer errors, simpler SDK integration
- Migration note: opcode contracts will transition to named exports with backward-compat shim
- Cross-reference added to contracts.html key facts section

**Files modified:** `developers/contract-reference.html`, `developers/contracts.html`

**Follow-on workstream:** Migrate 8 opcode contracts (7 DEX + Prediction Market) to named-export style
with a compatibility shim during transition. This is now tracked outside the closed alignment plan in the contract-platform unification workstream.

### Task 2.9 — Cross-Contract Invocation (H-13)

**Status:** RESOLVED (already implemented)

**Finding:** Already implemented in full before this audit:
- **Runtime:** `host_cross_contract_call` in `core/src/contract.rs` (~300 lines) with:
  - Call depth limit (`MAX_CROSS_CALL_DEPTH`)
  - Compute budget deduction and propagation
  - Pending storage overlay for consistent reads across nested calls
  - Value transfer with delta-based accounting (avoids balance inflation)
  - Rollback on callee failure (storage changes, value deltas)
  - Event and log propagation from callee to caller
- **SDK:** `sdk/src/crosscall.rs` with `call_contract()`, `call_token_transfer()`, `call_token_balance_of()`
- **Tests:** `core/tests/cross_contract_call.rs` (425 lines, multiple scenarios)

All acceptance criteria met: contracts can call other contracts atomically, call depth is capped,
re-entrancy is protected via depth tracking.

### Task 2.10 — DHT Peer Discovery + PEX (H-8, H-9)

**Status:** DONE

**Findings:** H-8 (no structured peer discovery) and H-9 (no peer exchange protocol).

**Pre-existing:**
- PEX already implemented: `PeerRequest`/`PeerInfo` message types in P2P protocol. Peers exchange
  known-peer lists on request, capped at 50 entries with reputation scores.
- Kademlia DHT routing table (`p2p/src/kademlia.rs`, 301 lines, 8 tests) already existed but was
  not wired into the network layer.

**Implemented:**
- Integrated `KademliaTable` into `P2PNetwork` struct with `Arc<Mutex<...>>` for thread safety.
- Node ID derived from SHA-256 of listen address.
- DHT updated on: `PeerInfo` receipt (hash peer addresses into node IDs), `ValidatorAnnounce`
  receipt (use validator pubkey as node ID).
- `PeerRequest` handler now merges PeerManager scores (up to 40) + DHT closest nodes (up to 10)
  for richer peer discovery responses, deduplicating by address.

**Files modified:** `p2p/src/network.rs`

**Tests:** 1,454 total workspace tests passing.

### Task 2.11 — Governance Parameter Changes (H-15)

**Status:** DONE

**Implemented:**
- **System instruction type 29 — `GovernanceParamChange`**: Data layout is `[29, param_id, value_u64_le]`
  (10 bytes). Requires the signer to be the stored governance authority.
- **8 governable parameters** (param_ids 0–7): base_fee, fee_burn_percent, fee_producer_percent,
  fee_voters_percent, fee_treasury_percent, fee_community_percent, min_validator_stake, epoch_slots.
- **Validation**: Each param has range checks (e.g., percentages 0–100, base_fee > 0, stake ≥ 1 LICN).
- **Queuing mechanism**: Changes are queued in RocksDB (`pending_gov_{id}`) and applied at the next
  epoch boundary. A newer submission for the same param_id overwrites the previous pending value.
- **Epoch boundary application**: `state.apply_pending_governance_changes()` called by the validator
  at each epoch boundary. Updates FeeConfig for fee params, sets min_validator_stake and epoch_slots
  in state. Clears pending queue after application.
- **Governance authority**: Stored in CF_STATS (`governance_authority`). Can be set to a LichenDAO
  contract address or designated multisig.

**Files modified:** `core/src/processor.rs`, `core/src/state.rs`, `core/src/lib.rs`,
`validator/src/main.rs`

**Tests:** 11 new tests (base_fee, fee_percentages, min_stake, epoch_slots, unauthorized signer,
no authority configured, invalid base_fee, invalid percentage, unknown param, data too short,
overwrite pending). 1,465 total workspace tests passing.

### Task 2.12 — Compute Gas Metering for Native Instructions (M-5)

**Status:** DONE

**Problem:** All native system instructions cost the same flat base fee regardless of computational
complexity. Transfer costs the same as ZK verification or contract deployment.

**Solution:** Each native instruction type now has a compute unit (CU) cost. CU is tracked in
`TxResult.compute_units_used` and `SimulationResult.compute_used`.

**CU cost table** (`compute_units_for_instruction()` in `core/src/processor.rs`):
| Instruction Type | CU Cost | Rationale |
|-----------------|---------|----------|
| Transfer (0) | 150 | Simple balance update |
| Stake/Unstake (2,3) | 300 | Stake pool state mutation |
| NFT operations (4-8) | 500 | Collection + metadata writes |
| CreateAccount (9) | 200 | Single state insert |
| Deploy contract (10) | 10,000 | WASM compilation + storage |
| Contract call | via WASM metering | Already tracked by WASM VM |
| ZK verify (11) | 50,000 | Groth16 verification (expensive) |
| Identity/Governance (20-29) | 200-500 | Moderate state operations |
| Unknown | 100 | Conservative default |

**`compute_units_for_tx(tx) → u64`**: Sums CU for all native instructions in a transaction.
Contract instructions (program_id `[0xFF; 32]`) are excluded (tracked separately by WASM VM).

**Integration points:**
- `TxResult` struct: new `compute_units_used: u64` field
- `make_result()`: accepts CU parameter, passes through to TxResult
- `process_transaction_inner()`: computes CU before execution, includes in success result
- `simulate_transaction()`: computes native CU, adds to WASM compute_used for total

**Files modified:** `core/src/processor.rs`, `core/src/lib.rs`

**Tests:** 11 new tests (per-type CU lookup, multi-instruction sum, contract exclusion,
TxResult integration). 1,476 total workspace tests passing.

### Task 2.13 — Wire Gas Display to Explorer

**Status:** DONE

**Changes:**
- `tx_to_rpc_json()` in `rpc/src/lib.rs`: computes `compute_units_for_tx(tx)` and includes
  `compute_units` field in every transaction JSON response.
- `explorer/transaction.html`: Added "Compute Units" row in fee details section (`id="computeUnits"`).
- `explorer/js/transaction.js`: Reads `tx.compute_units` from RPC response, displays as
  `formatNumber(cu) + ' CU'` in the fee breakdown panel.

**Files modified:** `rpc/src/lib.rs`, `explorer/transaction.html`, `explorer/js/transaction.js`

### Task 2.14 — Gas Estimation RPC (`estimateTransactionFee`) (M-18)

**Status:** DONE

**Problem:** No way to estimate a transaction's fee before submitting it. Wallets and SDKs
had to hardcode the base fee.

**Solution:** New `estimateTransactionFee` RPC method that accepts a base64-encoded transaction
and returns the computed fee, LICN equivalent, and compute units — without executing it.

**Request:** `estimateTransactionFee([base64_encoded_tx])` or `estimateTransactionFee([base64_tx, "json"])`
**Response:**
```json
{
  "fee_spores": 1000000,
  "fee_licn": 0.001,
  "compute_units": 150
}
```

**Implementation:** Decodes the transaction (bincode or JSON), validates limits, calls
`TxProcessor::compute_transaction_fee()` and `compute_units_for_tx()`. Classified as
"Expensive" in rate limiting (same tier as `simulateTransaction`).

**Files modified:** `rpc/src/lib.rs`, `rpc/tests/rpc_full_coverage.rs`

**Tests:** 2 new tests (missing params error, invalid base64 error). 1,478 total tests passing.

### Task 3.2 — Deterministic BFT Timestamps (M-15)

**Status:** DONE

**Problem:** Block timestamps were set by the block producer's wall clock, making them
trivially manipulable and non-deterministic across validators. Real BFT chains (CometBFT,
Tendermint) use consensus-derived timestamps.

**Solution:** CometBFT BFT Time model — each validator includes its wall-clock timestamp in
its precommit vote. The next block's proposer computes the stake-weighted median of the
parent block's commit vote timestamps. This ensures:
- Determinism: any node replaying the chain derives the same timestamp
- Manipulation resistance: attacker must control >1/3 stake to shift the median
- Monotonicity: BFT timestamp is clamped to `parent_timestamp + 1` minimum

**Precommit signable bytes (updated):** `0x02 || height(8 LE) || round(4 LE) || block_hash(32) || timestamp(8 LE)`

**Weighted median algorithm:**
1. Collect `(timestamp, stake)` pairs from commit signatures (only validators in the active set with stake > 0)
2. Sort by timestamp ascending
3. Walk cumulative stake; return the timestamp where cumulative stake first reaches `total_stake / 2`

**Timestamp validation:** Proposed timestamp must not exceed the validator's local clock by more than 30 seconds (matching CometBFT PBTS precision + message delay tolerance).

**Backward compatibility:** `CommitSignature.timestamp` has `#[serde(default)]` so legacy blocks (pre-BFT timestamps) deserialize with timestamp = 0. Proposers fall back to wall-clock time when no parent commit signatures exist (genesis, solo validator).

**RPC:** `getBlockCommit` now returns per-signature `timestamp` and a computed `bft_timestamp` field.

**Files modified:** `core/src/block.rs`, `core/src/consensus.rs`, `core/src/lib.rs`, `validator/src/consensus.rs`, `validator/src/block_producer.rs`, `validator/src/main.rs`, `rpc/src/lib.rs`

**Tests:** 5 new tests — weighted median (equal stake), weighted median (unequal stake), monotonicity enforcement, empty commit returns None, serde default backward compat.

### Task 3.3 — Contract Upgrade Governance / Timelock (M-14)

**Status:** DONE

**Problem:** Contract upgrades were owner-only with no delay — the owner could instantly
swap out contract code with no community visibility or veto opportunity.

**Solution:** Optional N-epoch timelock for contract upgrades. Contracts opt-in via
`SetUpgradeTimelock` instruction. Once enabled:
1. `Upgrade` → staged (code validated, stored as `PendingUpgrade`, not applied)
2. After N epochs, owner calls `ExecuteUpgrade` to apply
3. During the delay, governance authority can `VetoUpgrade` to cancel

**New `ContractInstruction` variants:**
- `SetUpgradeTimelock { epochs: u32 }` — owner sets/updates timelock (0 removes it)
- `ExecuteUpgrade` — owner applies staged upgrade after timelock expires
- `VetoUpgrade` — governance authority cancels pending upgrade

**New `ContractAccount` fields** (backward-compatible via `#[serde(default)]`):
- `upgrade_timelock_epochs: Option<u32>` — None = instant upgrades (legacy)
- `pending_upgrade: Option<PendingUpgrade>` — staged code + epoch metadata

**Safety rules:**
- Cannot submit a second upgrade while one is pending
- Cannot remove timelock while an upgrade is pending
- ExecuteUpgrade checks `current_epoch > execute_after_epoch`
- VetoUpgrade restricted to governance authority only
- WASM validation happens at submission time (not at execution)

**Bug fix (bonus):** Changed `contract_upgrade` to use `ContractRuntime::new()` instead of
`get_pooled()` for WASM validation — the Wasmer metering middleware panics when reused
across multiple `Module::new()` calls on a pooled runtime.

**Files modified:** `core/src/contract.rs`, `core/src/contract_instruction.rs`, `core/src/lib.rs`,
`core/src/processor.rs`, `validator/src/main.rs`

**Tests:** 11 new tests — set+stage, instant upgrade, double-stage rejection, execute before
expiry fails, no pending execute fails, governance veto, non-governance veto fails, timelock
removal blocked while pending, timelock removal succeeds, serde backward compat.

### Task 3.4 — EVM Precompiles + eth_getLogs (M-12)

**Status:** DONE

**Problem:** Three gaps in EVM compatibility:
1. Precompile support was implicit (REVM includes them) but undocumented and untested
2. `eth_getLogs` only read from native `ContractEvent` — real EVM logs (emitted by Solidity
   contracts) were captured as raw bytes without address/topics structure
3. `eth_getTransactionReceipt` returned logs as raw byte arrays, not structured EVM log objects

**Solution:**

**1. Precompile Documentation + Constants**
- Added 9 precompile address constants (`PRECOMPILE_ECRECOVER` through `PRECOMPILE_BLAKE2F`,
  addresses 0x01–0x09) matching standard Ethereum addresses per EIP-196/197/198/152
- Added `supported_precompiles()` function returning all 9 addresses with names
- REVM `build_mainnet()` with `SpecId::PRAGUE` already includes all standard precompiles —
  no code changes needed for execution, only documentation and discoverability

**2. Structured EVM Log Capture**
- Added `EvmLog` struct: `{ address: [u8;20], topics: Vec<[u8;32]>, data: Vec<u8> }` —
  matches Ethereum log format exactly
- Added `EvmLogEntry` struct: `{ tx_hash, tx_index, log_index, log: EvmLog }` — indexed entry
- Updated `EvmExecutionResult` with `structured_logs: Vec<EvmLog>` field
- Updated `EvmReceipt` with `structured_logs: Vec<EvmLog>` field (backward-compatible
  via `#[serde(default, skip_serializing_if = "Vec::is_empty")]`)
- Updated `execute_evm_transaction()` to extract full REVM `Log` objects with address,
  topics, and data

**3. Per-Slot EVM Log Index (CF_EVM_LOGS_BY_SLOT)**
- New RocksDB column family `CF_EVM_LOGS_BY_SLOT`: key = slot(8,BE), value = bincode
  serialized `Vec<EvmLogEntry>`
- `StateStore::put_evm_logs_for_slot()` appends logs (supports multiple EVM txs per slot)
- `StateStore::get_evm_logs_for_slot()` returns all EVM logs for a slot
- `StateBatch::put_evm_logs_for_slot()` for atomic batch operations
- Processor stores EVM logs during tx processing via batch helper

**4. Rewritten eth_getLogs (Two-Phase)**
- Phase 1: Reads structured EVM logs from per-slot index — uses `topics_match()` and
  address filter (single or array) per EIP-1474
- Phase 2: Falls back to native `ContractEvent` for backward compatibility — still uses
  Keccak256 for event name hashing (AUDIT-FIX A11-02 preserved)
- `topics_match()` function: supports null=wildcard, single hash=exact, array=OR per position

**5. Updated eth_getTransactionReceipt**
- Returns structured logs array with proper EVM format per log entry (address, topics, data,
  logIndex, transactionHash, transactionIndex, blockNumber, blockHash, removed)
- Includes logsBloom placeholder

**New types:** `EvmLog`, `EvmLogEntry`
**New constants:** 9 `PRECOMPILE_*` constants
**New functions:** `supported_precompiles()`, `topics_match()`, `parse_topic_hash()`
**New CF:** `CF_EVM_LOGS_BY_SLOT`

**Files modified:** `core/src/evm.rs`, `core/src/state.rs`, `core/src/processor.rs`,
`core/src/lib.rs`, `rpc/src/lib.rs`

**Tests:** 26 new tests — EvmLog/EvmLogEntry serde roundtrip (bincode + JSON), topics_match
(wildcard, empty, exact, OR-array, insufficient topics, empty logs), precompile constants
and addresses, supported_precompiles function, EvmReceipt backward compat and structured
logs, EvmExecutionResult structured logs, EVM log storage roundtrip (put/get, append,
empty noop, slot independence), parse_topic_hash (valid/invalid/known EVM), eth_getLogs
integration (stored EVM logs, address filter, address array, topic filter, OR topics,
wildcard topics, block range, full log format), precompile discoverability, topics_match
integration.

| # | Task | Finding | Status |
|---|------|---------|--------|
| 2.1 | Silent reward failure (RESOLVED by 1.1) | H-2 | RESOLVED |
| 2.2 | Bootstrap grant vesting review | H-3 | RESOLVED |
| 2.3 | Merkle tree upgrade (RESOLVED by 1.3) | H-4 | RESOLVED |
| 2.4 | State growth management (dormancy rent) | H-5 | DONE |
| 2.5 | Durable nonce system instruction | H-6 | DONE |
| 2.6 | EVM transaction envelope type | H-10 | DONE |
| 2.7 | Rename Solana compat endpoint + docs | H-11 | DONE |
| 2.8 | Unify contract dispatch (document short-term) | H-12 | DONE |
| 2.9 | Cross-contract invocation (CPI) | H-13 | RESOLVED |
| 2.10 | DHT peer discovery + PEX | H-8, H-9 | DONE |
| 2.11 | Governance parameter changes on-chain | H-15 | DONE |
| 2.12 | Compute gas metering for native instructions | M-5 | DONE |
| 2.13 | Wire gas display to explorer | — | DONE |
| 2.14 | Gas estimation RPC (`estimateTransactionFee`) | M-18 | DONE |

### Phase 3 — Medium Priority

| # | Task | Finding | Status |
|---|------|---------|--------|
| 3.1 | Epoch boundary logic | M-1 | DONE (rewards in 1.1q, governance in 2.11) |
| 3.2 | Deterministic BFT timestamps | M-15 | DONE |
| 3.3 | Contract upgrade governance (timelock) | M-14 | DONE |
| 3.4 | EVM precompiles + eth_getLogs | M-12 | DONE |
| 3.5 | WASM memory limit increase | M-13 | DONE |
| 3.6 | Oracle multi-source attestation | M-17 | DONE |
| 3.7 | Remove mempool express lane | M-8 | DONE |
| 3.8 | WebSocket keepalive standard | M-19 | DONE |
| 3.9 | Historical state queries (archive mode) | M-16 | DONE |
| 3.10 | Payload type envelope | M-6 | DONE |
| 3.11 | TOFU certificate rotation | M-9 | DONE |
| 3.12 | Eclipse defense (AS-level) | M-10 | DONE |

### Phase 4 — Polish

| # | Task | Finding | Status |
|---|------|---------|--------|
| 4.1 | Transaction hash determinism docs | H-7 | DONE |
| 4.2 | Fee discount MEV audit | M-7 | DONE |
| 4.3 | Contract storage protocol enforcement | M-4 | DONE |
| 4.4 | IBC exploration + scoping | H-14 | DONE |

### Phase 5 — v0.4.5 Production Hardening

Additional validator infrastructure hardening not covered by the original 39 findings.

| # | Task | Description | Status |
|---|------|-------------|--------|
| 5.1 | Epoch-frozen validator sets | Validator set changes (add/remove/stake) deferred to epoch boundaries. `consensus_set()` filters `pending_activation` validators. Height-frozen snapshots use epoch-frozen consensus set. Epoch boundary activates pending and processes removals. | DONE |
| 5.2 | DeregisterValidator (opcode 31) | Voluntary validator exit instruction. Sets validator inactive in stake pool, queues `PendingValidatorChange::Remove` for next epoch boundary. Idempotent for already-inactive validators. | DONE |
| 5.3 | Commit certificate cross-reference | Block receiver verifies `validators_hash` in received blocks matches the local epoch-frozen validator set hash. Prevents blocks signed by a stale or forked validator set from being accepted. | DONE |
| 5.4 | Clippy CI compliance | Fixed 4 warnings: `len_zero` (rpc), `needless_range_loop` (evm), `assertions_on_constants` (contract), manual `abs_diff` (consensus). Zero warnings on `cargo clippy --workspace -- -D warnings`. | DONE |
| 5.5 | Start script cleanup | Renamed JOINING → BOOTSTRAP in lichen-start.sh for consistency with `--bootstrap` flag. Updated contract count (26 → 29). | DONE |

**New types (v0.4.5):**
- `ValidatorChangeType` enum: `Add`, `Remove`, `StakeUpdate`
- `PendingValidatorChange` struct: `{ change_type, validator_pubkey, effective_epoch, queued_slot, stake_amount }`
- `ValidatorInfo.pending_activation: bool` — new validators invisible to consensus until epoch activation
- `ValidatorSet.frozen_epoch: u64` — epoch at which the set was frozen

**New state methods:**
- `queue_pending_validator_change()` — stores change keyed by `(epoch, slot, pubkey_prefix)` in `CF_PENDING_VALIDATOR_CHANGES`
- `get_pending_validator_changes(epoch)` — prefix-scans all changes for an epoch
- `clear_pending_validator_changes(epoch)` — batch-deletes processed changes

**Epoch boundary processing (validator/src/main.rs):**
1. Process `Remove` changes: set `is_active = false` via `get_stake_mut()`
2. Call `activate_pending_validators()`: flip `pending_activation = false` for all pending validators
3. Persist updated validator set
4. Clear processed pending changes
5. Freeze new epoch set: `set_frozen_epoch(new_epoch)`

**Files modified:** `core/src/consensus.rs`, `core/src/state.rs`, `core/src/lib.rs`,
`core/src/processor.rs`, `core/src/block.rs`, `core/src/genesis.rs`, `core/src/evm.rs`,
`core/src/contract.rs`, `core/tests/basic_test.rs`, `core/tests/production_readiness.rs`,
`validator/src/consensus.rs`, `validator/src/main.rs`, `rpc/tests/rpc_full_coverage.rs`,
`lichen-start.sh`

---

## Appendix: Quick Reference — How Real Chains Compare

### Consensus

| Feature | Cosmos/CometBFT | Solana | Ethereum | Lichen (current) | Lichen (target) |
|---------|-----------------|--------|----------|---------------------|-------------------|
| Finality | Instant (1 block) | ~32 slots | ~15 min (PoS: 2 epochs) | Instant BFT commit + commit cert | Instant + commit cert |
| Commit proof | Aggregated sigs in block | Vote accounts | Sync committees | CommitSignature array | CommitSignature array |
| Leader selection | Weighted RR | PoH + stake schedule | RANDAO | Stake-weighted RR | Same |
| Timeout backoff | Exponential | N/A (PoH) | N/A | Exponential (1.5^r, cap 60s) | Exponential (1.5^r, cap 60s) |
| State proofs | IAVL+ | Account proofs | MPT proofs | Anchored account inclusion proofs | Anchored account inclusion proofs with finalized block context |

### Economics

| Feature | Cosmos | Solana | Ethereum | Lichen (current) | Lichen (target) |
|---------|--------|--------|----------|---------------------|-------------------|
| Supply | Inflationary | Inflationary | Inflationary | Fixed 1B | 500M genesis + inflation |
| Inflation | 7–20% dynamic | 8% → 1.5% | ~0.5% | 0% | 4% → 0.15% |
| Fee burn | None | 50% | ~100% base fee | 40% permanent | 40% permanent |
| Reward source | Minted | Minted | Minted | Fixed pool (100M) | Minted |
| Net deflation? | No | At scale | When busy | Always (but pool depletes) | When busy |

### State

| Feature | Cosmos | Solana | Ethereum | Lichen (current) | Lichen (target) |
|---------|--------|--------|----------|---------------------|-------------------|
| State root | IAVL app hash | Bank hash | MPT root | Binary Merkle | Binary Merkle (with proofs) |
| Proofs | IAVL proofs | Account proofs | Merkle proofs | O(log N) inclusion | O(log N) inclusion |
| Rent | None | Destructive | None (gas pays) | Graduated dormancy (no eviction) | Graduated dormancy (no eviction) |
| Light clients | Yes (IBC) | Partial | Sync committees | Partial building blocks only | Commit certs + anchored proof primitives; full IBC intentionally deferred |

---

## Decision Log

| Date | Decision | Notes |
|------|----------|-------|
| 2026-03-14 | **Option B confirmed** (inflationary + burn) | 4% initial inflation, 15% annual decay, 0.15% floor. 40% fee burn as counter-pressure. |
| 2026-03-14 | **Phase 1 priority: 1.1 → 1.4** | Supply model first, then commit certs, state proofs, timeout fix. |
| 2026-03-14 | **Compute gas metering moved to Phase 2.12** | Will be priced based on vision + current fee structure comparison. |
| 2026-03-15 | **Epoch-based staker rewards (Solana model)** | Per-slot block producer rewards replaced with epoch boundary distribution to ALL stakers. Prevents validator income asymmetry at low validator counts. |
| 2026-03-15 | **Block commit certificates (Task 1.2)** | CommitSignature struct added to Block. Precommit signatures retained in consensus engine. verify_commit() checks 2/3+ stake supermajority via Ed25519 signatures. P2P propagates commit sigs. RPC exposes getBlockCommit endpoint. 10 new tests (7 block + 3 consensus), 1,416 total passing. |
| 2026-03-15 | **Merkle proofs + state proofs (Task 1.3)** | MerkleProof and AccountProof types with O(log N) proof generation. build_merkle_tree retains all levels. get_account_proof generates proof from CF_MERKLE_LEAVES cache. getAccountProof RPC endpoint. 15 new tests, 1,431 total passing. Phase 1 critical fixes COMPLETE. |
| 2026-03-15 | **.lichen domain expiry display enhanced** | Explorer, wallet, and extension now show remaining days, expiry date, and status badges with color-coded warnings. Fixed 63M→78.8M SLOTS_PER_YEAR in developer docs. |
| 2026-03-15 | **State growth management / dormancy rent (Task 2.4)** | Graduated epoch-based rent with 3 tiers (1×/2×/4× above 2KB free threshold). Dormancy after 2 missed epochs — accounts persist but excluded from state root. Reactivation via transfer. 11 new tests, 1,442 total passing. |
| 2026-03-15 | **Durable nonce system (Task 2.5)** | System instruction type 28 with sub-opcodes: Initialize(0), Advance(1), Withdraw(2), Authorize(3). NonceState stored in account data (authority + blockhash + fee_calculator). Durable transaction validation: if blockhash not recent, checks nonce account in first instruction. 9 new tests, 1,453 total passing. |
| 2026-03-15 | **EVM transaction envelope type (Task 2.6)** | TransactionType enum (Native/Evm/SolanaCompat) replaces sentinel blockhash detection. is_evm() backward-compat: checks enum OR legacy sentinel. new_evm() constructor. Wire format adds 4 bytes (u32 LE variant). Golden vectors and SDK wire format tests updated. 1,453 total passing. |
| 2026-03-15 | **Rename Solana compat endpoint (Task 2.7)** | Canonical `/solana` → `/solana-compat`. Legacy alias preserved. Tests + docs updated. Clear disclaimer added: accepts Lichen txs in Solana format only. 1,454 total passing. |
| 2026-03-15 | **Document contract dispatch (Task 2.8)** | Enhanced developer portal with named-export vs opcode-dispatch rationale, recommendation to use named exports for new contracts, migration plan noted. |
| 2026-03-15 | **Cross-contract invocation RESOLVED (Task 2.9)** | Already fully implemented: host_cross_contract_call runtime (~300 lines), SDK crosscall module, 425 lines of tests. All acceptance criteria met. |
| 2026-03-15 | **DHT peer discovery + PEX (Task 2.10)** | Kademlia DHT (pre-existing 301-line module) integrated into P2PNetwork. SHA-256 node IDs. DHT updated on PeerInfo and ValidatorAnnounce. PeerRequest responses merge PeerManager + DHT closest(). PEX already existed. 1,454 total passing. |
| 2026-03-15 | **Governance parameter changes (Task 2.11)** | System instruction type 29 queues changes for epoch-boundary application. 8 governable params (base_fee, 5 fee percentages, min_validator_stake, epoch_slots). Governance authority stored in state. 11 new tests, 1,465 total passing. |
| 2026-03-15 | **Compute gas metering (Task 2.12)** | Per-instruction CU costs for all 29 native instruction types. TxResult.compute_units_used field. compute_units_for_tx() sums native CU. ZK verify = 50K CU, deploy = 10K, transfer = 150. Simulation includes native + WASM CU. 11 new tests, 1,476 total passing. |
| 2026-03-15 | **Wire gas display to explorer (Task 2.13)** | RPC tx_to_rpc_json() includes compute_units field. Explorer transaction.html has CU row in fee details. JS reads tx.compute_units and formats with CU suffix. |
| 2026-03-15 | **Gas estimation RPC (Task 2.14)** | estimateTransactionFee accepts base64 tx, returns fee_spores + fee_licn + compute_units without execution. Rated as "Expensive" for rate limiting. 2 new tests, 1,478 total passing. Phase 2 COMPLETE. |
| 2026-03-16 | **Deterministic BFT timestamps (Task 3.2)** | CometBFT BFT Time model. Precommit votes include wall-clock timestamp in signed message. Block proposer computes stake-weighted median from parent's commit signatures. Monotonicity enforced (≥ parent_timestamp + 1). 30s future tolerance for timestamp validation. Backward-compatible via serde(default). RPC getBlockCommit includes per-vote timestamp + bft_timestamp. 5 new tests, 1,483 total passing. |
| 2026-03-16 | **Contract upgrade timelock (Task 3.3)** | Optional N-epoch timelock for contract upgrades. SetUpgradeTimelock, ExecuteUpgrade, VetoUpgrade instructions. Governance authority can cancel pending upgrades. Cannot double-stage or remove timelock while upgrade pending. WASM validation at submission. Fixed pooled ContractRuntime metering reuse bug. 11 new tests, 1,494 total passing. |
| 2026-03-16 | **EVM precompiles + eth_getLogs (Task 3.4)** | Documented 9 standard Ethereum precompiles (0x01–0x09) already supported via REVM PRAGUE. Added EvmLog/EvmLogEntry structs for structured log capture. New CF_EVM_LOGS_BY_SLOT per-slot index. Two-phase eth_getLogs: structured EVM logs first, native ContractEvent fallback. EIP-1474 topic filtering (wildcard, exact, OR-array). address filter (single + array). eth_getTransactionReceipt returns structured logs. 26 new tests, 1,531 total passing. |
| 2026-03-16 | **WASM memory limit increase (Task 3.5)** | MAX_WASM_MEMORY_PAGES raised from 256 (16MB) to 1024 (64MB). New DEFAULT_WASM_MEMORY_PAGES = 16 (1MB) ensures contracts start with adequate memory. Auto-grow at instantiation if declared < 16 pages. Both constants pub-exported for SDK use. 7 new tests, 1,538 total passing. |
| 2026-03-16 | **Oracle multi-source attestation (Task 3.6)** | Native system instruction type 30 for validator oracle price attestation. OracleAttestation and OracleConsensusPrice types stored in CF_STATS. Quorum: strict >2/3 active stake (Tendermint convention). Price algorithm: stake-weighted median (same as BFT timestamps). Staleness: 9,000 slots (~1hr). Asset names 1–16 bytes UTF-8. 4 new state.rs storage methods. 15 new tests (11 oracle + 4 median), 1,550 total passing. |
| 2026-03-16 | **Express lane removal (Task 3.7)** | Removed express_queue and reputation-based effective_priority multiplier from mempool. All transactions now ordered strictly by fee then FIFO. Removed validator reputation lookups for P2P and RPC tx paths. Updated developer portal (lichenid, architecture, changelog). 3 tests replaced, 1,550 total passing. |
| 2026-03-16 | **WebSocket keepalive standard (Task 3.8)** | RFC 6455 keepalive: WS_PING_INTERVAL_SECS=30 constant, Arc<AtomicBool> pong_pending flag for dead-connection detection, strict single-pong timeout. Updated ws-reference.html keepalive docs. 3 new tests, 1,553 total passing. |
| 2026-03-16 | **Historical state queries / archive mode (Task 3.9)** | Write-through archive snapshots via CF_ACCOUNT_SNAPSHOTS (pubkey+slot key). Hooks in put_account_with_hint (direct) and StateBatch::put_account (batch). O(1) reverse-seek get_account_at_slot. Pruning + oldest_snapshot_slot. RPC getAccountAtSlot endpoint. Arc<AtomicBool> archive_mode toggle. 15 new tests (11 state + 4 RPC), 1,568 total passing. |
| 2026-03-16 | **Payload type envelope (Task 3.10)** | Wire envelope format: [0x4D,0x54] magic + version byte + type byte + bincode payload. Transaction::to_wire() replaces bincode::serialize at 13 encode sites (CLI 10, SDK 1, validator 1, custody 1). Transaction::from_wire() three-format decoder (envelope → legacy bincode → JSON). decode_transaction_bytes() centralizes all 7+ RPC decode sites. 14 new tests (11 core wire_format + 3 RPC integration), 1,582 total passing. |
| 2026-03-16 | **TOFU certificate rotation (Task 3.11)** | CertRotation P2P gossip message with old_fingerprint, new_fingerprint, new_cert_der, rotation_proof, timestamp. PeerFingerprintStore.apply_rotation() validates: old FP match → verify_self_signed_cert → FP/cert consistency → 1-hour rate limit. Successful rotations re-gossipped to all peers. PeerManager.rotate_local_certificate() for node-initiated rotation. 6 new tests, 1,595 total passing. |
| 2026-03-16 | **Eclipse defense AS-level (Task 3.12)** | Lightweight /16 IPv4 and /32 IPv6 prefix bucketing as ASN approximation. MAX_PEERS_PER_ASN_BUCKET=4. asn_bucket() + same_asn_bucket() utilities. Hooked into connect_peer() after existing /24 subnet check. Zero external dependencies. 7 new tests, 1,595 total passing. Phase 3 COMPLETE. |
| 2026-03-16 | **Transaction hash determinism (Task 4.1)** | Dual hash exposure: Transaction::hash() (txid, includes sigs) + Transaction::message_hash() (signing hash, sig-independent). RPC getTransaction includes both fields. 8 new wire_format tests + 1 RPC test. Matches Bitcoin wtxid and Cosmos SHA-256(tx_bytes) convention. 1,613 total passing. |
| 2026-03-16 | **Fee discount MEV audit (Task 4.2)** | Reputation-based fee discounts (5–10%) REMOVED. No real chain uses identity-based fee discounts. All users now pay flat fees. apply_reputation_fee_discount() deprecated (returns base_fee unchanged). LichenID reputation kept for display/rate-limiting only. |
| 2026-03-16 | **Contract storage protocol enforcement (Task 4.3)** | Per-byte compute cost (COMPUTE_STORAGE_WRITE_PER_BYTE=1) + MAX_TOTAL_STORAGE_BYTES=10MB cap enforced at host function level. storage_bytes_used tracked in ContractContext, updated on writes and deletes. 5 new tests, 1,613 total passing. |
| 2026-03-16 | **IBC exploration (Task 4.4)** | Full research doc at docs/strategy/IBC_EXPLORATION.md. Lichen has IBC prerequisites (commit certs, state proofs, BFT finality). Missing: LC module, ICS-3/4 handshake, ICS-20. Decision: Full IBC deferred — LichenBridge provides adequate cross-chain for current phase. Phase 4 COMPLETE. |
| 2026-03-18 | **Epoch-frozen validator sets (Task 5.1)** | Validator set changes deferred to epoch boundaries. New `consensus_set()` method filters pending validators. PendingValidatorChange queue in CF_PENDING_VALIDATOR_CHANGES. ValidatorAnnounce sets `pending_activation: true` for mid-epoch joins. Epoch boundary activates pending + processes removals. Phase 5 hardening. |
| 2026-03-18 | **DeregisterValidator opcode 31 (Task 5.2)** | System instruction type 31 for voluntary validator deregistration. Sets validator inactive in stake pool, queues Remove change for next epoch. Idempotent — returns Ok if already inactive. 500 CU cost. |
| 2026-03-18 | **Commit certificate cross-reference (Task 5.3)** | Block receiver validates `validators_hash` against local epoch-frozen set. Prevents stale/forked validator set blocks from being accepted. |
| 2026-03-18 | **Clippy CI compliance (Task 5.4)** | Fixed 4 warnings across workspace. `cargo clippy --workspace -- -D warnings` clean. |
| 2026-03-18 | **Start script cleanup (Task 5.5)** | JOINING → BOOTSTRAP rename in lichen-start.sh. Contract count 26 → 29. Phase 5 COMPLETE. Plan CLOSED. |

---

*This document is CLOSED. All phases complete. v0.4.0 (39 findings) + v0.4.5 (5 hardening tasks).*
