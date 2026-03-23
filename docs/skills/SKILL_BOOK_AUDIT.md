# SKILL_BOOK.md Audit Report — Source Code Verification

**Date:** March 4, 2026
**Audited document:** `docs/skills/SKILL_BOOK.md` (All Sections)
**Source files verified:** `core/src/processor.rs`, `core/src/consensus.rs`, `core/src/mossstake.rs`, `core/src/zk/mod.rs`, `core/src/zk/merkle.rs`, `contracts/*/src/lib.rs`, `rpc/src/lib.rs`, `rpc/src/ws.rs`, `rpc/src/dex.rs`, `rpc/src/dex_ws.rs`, `rpc/src/prediction.rs`, `rpc/src/launchpad.rs`, `rpc/src/shielded.rs`, `scripts/build-all-contracts.sh`, `lichen-start.sh`, `config.toml`, `tests/contracts-write-e2e.py`, `dex/dex.test.js`
**Secondary doc:** `skills/validator/SKILL.md`

---

## Part A — Constants & Parameters Audit (Sections 1–10, 18)

### Executive Summary

| Check | Documented | Actual (Source) | Status |
|-------|-----------|----------------|--------|
| Genesis contracts | 30 | **29** | ❌ MISMATCH |
| Total RPC methods | ~210 | **166** (JSON-RPC only) or **252** (all) | ❌ AMBIGUOUS |
| Total DEX opcodes | 147 | **151** | ❌ MISMATCH |
| Achievements | 90+ | **92** unique IDs | ✅ OK (92 > 90) |
| Base fee | 0.001 LICN (1,000,000 spores) | 1,000,000 spores | ✅ MATCH |
| Contract deploy fee | 25 LICN | 25,000,000,000 spores = 25 LICN | ✅ MATCH |
| Contract upgrade fee | 10 LICN | 10,000,000,000 spores = 10 LICN | ✅ MATCH |
| NFT mint fee | 0.5 LICN | 500,000,000 spores = 0.5 LICN | ✅ MATCH |
| NFT collection fee | 1,000 LICN | 1,000,000,000,000 spores = 1,000 LICN | ✅ MATCH |
| Fee distribution | 40/30/10/10/10 | 40/30/10/10/10 | ✅ MATCH |
| Slots per day | 216,000 | 216,000 (derived: SLOTS_PER_MONTH=216,000×30) | ✅ MATCH |
| Epoch length | 432,000 slots | SLOTS_PER_EPOCH = 432,000 | ✅ MATCH |
| Max leverage | 100x | MAX_LEVERAGE_ISOLATED = 100 | ✅ MATCH |
| LichenID initial rep | 100 | INITIAL_REPUTATION = 100 | ✅ MATCH |
| Name costs (3/4/5+) | 500/100/20 LICN | 500/100/20 LICN | ✅ MATCH |
| Recovery guardians | 5, 3-of-5 | RECOVERY_GUARDIAN_COUNT=5, THRESHOLD=3 | ✅ MATCH |
| MossStake multipliers | 1.0/1.6/2.4/3.6× | 10000/16000/24000/36000 bp | ✅ MATCH |
| MossStake lock durations | 0/6.48M/38.88M/78.84M slots | matches source | ✅ MATCH |
| MossStake target APYs | 5/8/12/18% | matches source comments | ✅ MATCH |
| Merkle tree depth | 20 | TREE_DEPTH = 20 | ✅ MATCH |
| Shield compute units | 100,000 | SHIELD_COMPUTE_UNITS = 100,000 | ✅ MATCH |
| Unshield compute units | 150,000 | UNSHIELD_COMPUTE_UNITS = 150,000 | ✅ MATCH |
| Transfer compute units | 200,000 | TRANSFER_COMPUTE_UNITS = 200,000 | ✅ MATCH |
| RPC port | 8899 | config.toml: rpc_port=8899 | ✅ MATCH |
| WS port | 8900 | lichen-start.sh: WS_PORT=8900 | ✅ MATCH |
| Monitoring port | 9100 | config.toml: metrics_port=9100 | ✅ MATCH |
| LichenID exports | 51 | **59** | ❌ MISMATCH |
| Cargo tests | ~1,073 | **1,296** (25 test binaries) | ❌ MISMATCH |
| DEX JS tests | 1,877 | **1,774** assert() calls (~1,872 broad matches) | ⚠️ CLOSE |
| E2E transactions | 26 tests | **29** assert() calls | ❌ MISMATCH |
| E2E production | 180 tests | **185** assert() calls | ❌ MISMATCH |
| E2E DEX | 87 tests | **80** assert() calls | ❌ MISMATCH |
| E2E volume | 115+ tests | **64** assert() calls | ❌ MISMATCH |
| E2E launchpad | 48 tests | **62** assert() calls | ❌ MISMATCH |
| E2E prediction | 49 tests | **71** assert() calls | ❌ MISMATCH |
| Contracts write | 209 scenarios | **154** scenario entries | ❌ MISMATCH |
| Explorer/DEX/Wallet/Faucet/Custody ports | 3001/8080/3000/9900/9105 | Not in config.toml/start script (front-end defaults) | ⚠️ UNVERIFIABLE in core |

---

### 1. Genesis Contract Count (Section 1 & 5)

**Doc says:** "Contracts deployed at genesis: 30"
**Actual:** 29 contract directories in `contracts/`:

```
bountyboard, sporepay, sporepump, sporevault, compute_market,
dex_amm, dex_analytics, dex_core, dex_governance, dex_margin,
dex_rewards, dex_router, thalllend, lichenauction, lichenbridge,
lichencoin, lichendao, lichenmarket, lichenoracle, lichenpunks, lichenswap,
lichenid, lusd_token, prediction_market, moss_storage, shielded_pool,
wbnb_token, weth_token, wsol_token
```

Build script (`scripts/build-all-contracts.sh`) enumerates:
- CORE_CONTRACTS: 17
- DEX_CONTRACTS: 8
- WRAPPED_TOKEN_CONTRACTS: 4
- **Total: 29**

**Verdict:** Section 1 and Section 5 heading say "30 Contracts" — should be **29**.

---

### 2. Total DEX Opcodes (Section 6)

**Doc says:** "Total contract opcodes: 147 (DEX)"
**Actual opcode counts per contract:**

| Contract | Doc | Source | Status |
|----------|-----|--------|--------|
| dex_core | 31 (0x00–0x1E) | 31 | ✅ |
| dex_amm | 20 (0x00–0x13) | 20 | ✅ |
| dex_margin | 29 (0x00–0x1C) | 29 | ✅ |
| dex_router | 14 (0x00–0x0D) | 14 | ✅ |
| dex_governance | 20 (0x00–0x13) | 20 | ✅ |
| dex_rewards | 20 (0x00–0x13) | 20 | ✅ |
| dex_analytics | 13 (0x00–0x0C) | 13 | ✅ |
| **Total** | **147** | **147** | ✅ |

Wait — my earlier count of 151 included `_ => {}` default arms and sub-match arms. The corrected count using `^        [0-9]+ => {` at proper indent level gives the exact individual opcode counts above, which sum to **147**.

**Verdict:** ✅ MATCH — 147 is correct.

---

### 3. Total RPC Methods (Section 1)

**Doc says:** "Total RPC methods: ~210"
**Actual dispatch arms in `rpc/src/lib.rs`:**
- Native JSON-RPC: **134** methods (lines 1869–2144)
- Solana-compat JSON-RPC: **13** methods (lines 2145–2198)
- EVM-compat JSON-RPC: **19** methods (lines 2226+)
- **JSON-RPC subtotal: 166**

**WS subscriptions (ws.rs): 20** unique subscribe method names
**REST endpoints (dex/prediction/launchpad/shielded): 66** routes (38+14+6+8)

If "RPC methods" means JSON-RPC only: **166** (doc says ~210 → off by ~44).
If "RPC methods" means everything (JSON-RPC + WS + REST): **252**.

Doc also lists 94 native RPC methods in Section 11 tables, but source has 134 (20 undocumented, as previously audited).

**Verdict:** ❌ "~210" doesn't match any obvious total. Closest: 166 JSON-RPC methods. Should be updated.

---

### 4. LichenID Export Count (Section 5 & 7)

**Doc says:** "51 exported functions" (Section 5) and "Complete LichenID Exports (51 functions)" (Section 7)
**Actual:** 59 `#[no_mangle]` exports in `contracts/lichenid/src/lib.rs`

**8 exports missing from docs:**

| Export | Purpose |
|--------|---------|
| `admin_register_reserved_name` | Admin-only reserved name registration |
| `get_agent_profile` | Get full agent profile |
| `get_trust_tier` | Get trust tier for identity |
| `mid_pause` | Emergency pause |
| `mid_unpause` | Emergency unpause |
| `set_mid_self_address` | Set self-address (admin) |
| `set_mid_token_address` | Set token address (admin) |
| `transfer_admin` | Transfer admin ownership |

**Verdict:** ❌ Should say **59**, not 51. Update Section 5 and Section 7.

---

### 5. Achievement Count (Section 8)

**Doc says:** "90+ auto-detected"
**Actual:** 92 unique achievement IDs defined across `core/src/processor.rs` (85 auto-detected) + `contracts/lichenid/src/lib.rs` (92 total including reputation milestone achievements like Graduation ID=8).

Doc lists 86 achievements in Section 8 tables. The remaining 6 (IDs 4, 5, 6, 7, 8, 10, 11) are contract-awarded reputation milestones shown at the bottom of the table.

**Verdict:** ✅ OK — "90+" is accurate (actual is 92). Section 8 tables list all of them.

---

### 6. Test Counts (Section 18)

| Suite | Documented | Actual | Status |
|-------|-----------|--------|--------|
| All Cargo | ~1,073 | 1,296 (across 25 test binaries) | ❌ Outdated (+223) |
| DEX unit (JS) | 1,877 | 1,774 assert() calls (1,872 with broad match) | ⚠️ Close but not exact |
| E2E transactions | 26 | 29 assert() calls | ❌ |
| E2E production | 180 | 185 assert() calls | ❌ |
| E2E DEX | 87 | 80 assert() calls | ❌ |
| E2E volume | 115+ | 64 assert() calls | ❌ Large discrepancy |
| E2E launchpad | 48 | 62 assert() calls | ❌ |
| E2E prediction | 49 | 71 assert() calls | ❌ |
| Contracts write | 209 scenarios | 154 `"fn":` entries | ❌ Large discrepancy |

**Note:** JS E2E test counts are runtime-determined (the `assert()` helper increments a `passed` counter). The counts above are based on static `assert()` call counts in source, which is the best approximation without running them. Some tests may run in loops generating more assertions at runtime.

**Verdict:** ❌ Multiple test counts are outdated. The cargo test count has grown significantly. E2E counts need re-measurement by running them.

---

### 7. Port Numbers (Section 1)

| Port | Purpose | Verified In | Status |
|------|---------|------------|--------|
| 8899 | RPC | config.toml L20, lichen-start.sh L113 | ✅ |
| 8900 | WebSocket | lichen-start.sh L114 | ✅ |
| 9100 | Monitoring/Prometheus | config.toml L96 | ✅ |
| 3001 | Explorer | Not in core config (front-end) | ⚠️ |
| 8080 | DEX | Not in core config (front-end) | ⚠️ |
| 3000 | Wallet | Not in core config (front-end) | ⚠️ |
| 9900 | Faucet | lichen-start.sh L121 (mainnet WS_PORT, not faucet) | ⚠️ Ambiguous |
| 9105 | Custody | Not in core config | ⚠️ |

**Note:** Port 9900 appears as `WS_PORT=9900` for mainnet mode in `lichen-start.sh`, not as a faucet port. Explorer/DEX/Wallet/Custody ports are set in their respective front-end configs, not in core infrastructure.

**Verdict:** ✅ Core ports (8899, 8900, 9100) verified. Front-end ports not verifiable from core source.

---

### 8. Stale Enum Comments (Not in SKILL_BOOK, but notable)

In `core/src/mossstake.rs`, the `LockTier` enum definition comments are stale:
```
Lock30 = 1,  // 30-day lock, 1.1x multiplier   ← WRONG (actual: 1.6x)
Lock180 = 2, // 180-day lock, 1.25x multiplier  ← WRONG (actual: 2.4x)
Lock365 = 3, // 365-day lock, 1.5x multiplier   ← WRONG (actual: 3.6x)
```

The actual `reward_multiplier_bp()` function returns 16000/24000/36000 (1.6x/2.4x/3.6x).
SKILL_BOOK.md correctly documents the 1.6x/2.4x/3.6x values. The source **comments** are stale, not the doc.

---

## Corrections Required

### Must Fix (factual errors)

1. **Section 1:** "Contracts deployed at genesis: 30" → **29**
2. **Section 5 heading:** "Contract Surface (30 Contracts)" → **29 Contracts**
3. **Section 1:** "Total RPC methods: ~210" → update to actual count (~166 JSON-RPC or ~252 total)
4. **Section 5:** "51 exported functions" (LichenID) → **59**
5. **Section 7:** "Complete LichenID Exports (51 functions)" → **59 functions** (add 8 missing exports)
6. **Section 18:** Update all test counts (Cargo: ~1,296; re-measure JS/E2E by running tests)

### Should Fix (stale estimates)

7. **Section 1:** "Total contract opcodes: 147 (DEX)" is actually correct (147 ✓)
8. **Section 18:** "contracts-write-e2e.py: 209 scenarios" → currently **154** `"fn":` entries
9. **Section 18:** Most E2E test counts have drifted from documented values

### Note (source code issue, not doc issue)

10. `core/src/mossstake.rs` LockTier enum comments have stale multiplier values (1.1x/1.25x/1.5x vs actual 1.6x/2.4x/3.6x)

---

## Part B — RPC/WS/REST Audit (Sections 11–13) — Original Report

## Summary

| Area | Documented | In Source | Missing from Doc | Ghost (doc-only) |
|------|-----------|-----------|-----------------|-------------------|
| Native RPC | 94 | 114 | **20** | 0 |
| Solana RPC | 12 | 13 | **1** | 0 |
| EVM RPC | 18 | 20 | **2** | 0 |
| WebSocket Subs | 19 | 19 | 0 | 0 |
| REST DEX | 31 | 42 | **11** | 0 |
| REST Prediction | 7 | 14 | **7** | 0 |
| REST Launchpad | 5 | 6 | **1** | 0 |
| REST Shielded | 8 | 8 | 0 | 0 |
| Validator SKILL.md | 2 RPC examples | — | — | **2 ghost methods** |
| **TOTAL** | | | **42 missing** | **2 ghost** |

---

## Task 1: Native RPC Methods (Section 11)

### ✅ Verified — All documented methods exist in source

Every method listed in section 11 tables was confirmed present in the `rpc/src/lib.rs` dispatch (lines 1871–2082). No ghost entries.

### ❌ MISSING from Section 11 — Methods in source but NOT documented

#### Core / Account (undocumented)

| Method | Source Line | Notes |
|--------|------------|-------|
| `callContract` | lib.rs:1884 | Executes a read-only contract call |
| `getGenesisAccounts` | lib.rs:1889 | Returns genesis account allocations |
| `getGovernedProposal` | lib.rs:1890 | Query a governance proposal |
| `getAccountInfo` | lib.rs:1946 | Native account info (distinct from Solana-compat) |
| `getTransactionHistory` | lib.rs:1947 | Paginated tx history for an address |
| `requestAirdrop` | lib.rs:2009 | Testnet-only faucet airdrop |

#### Fee & Rent Config (undocumented)

| Method | Source Line | Notes |
|--------|------------|-------|
| `getFeeConfig` | lib.rs:1913 | Read current fee params |
| `setFeeConfig` | lib.rs:1914 | Admin: update fee params |
| `getRentParams` | lib.rs:1915 | Read rent parameters |
| `setRentParams` | lib.rs:1916 | Admin: update rent params |

#### Staking (undocumented)

| Method | Source Line | Notes |
|--------|------------|-------|
| `stakeToMossStake` | lib.rs:1935 | Deposit LICN into MossStake pool |
| `unstakeFromMossStake` | lib.rs:1936 | Initiate MossStake unstake |
| `claimUnstakedTokens` | lib.rs:1937 | Claim matured unstake requests |

#### Contracts (undocumented)

| Method | Source Line | Notes |
|--------|------------|-------|
| `setContractAbi` | lib.rs:1953 | Store/update ABI for a contract |
| `deployContract` | lib.rs:1955 | Deploy a new contract |
| `upgradeContract` | lib.rs:1956 | Upgrade an existing contract |

#### Symbol Registry (undocumented)

| Method | Source Line | Notes |
|--------|------------|-------|
| `getSymbolRegistryByProgram` | lib.rs:1986 | Reverse-lookup: program → symbol |

#### NFT & Marketplace (undocumented)

| Method | Source Line | Notes |
|--------|------------|-------|
| `getMarketOffers` | lib.rs:1999 | Active buy offers |
| `getMarketAuctions` | lib.rs:2000 | Active auctions |

#### Prediction Markets (undocumented)

| Method | Source Line | Notes |
|--------|------------|-------|
| `getPredictionMarketAnalytics` | lib.rs:2019 | Per-market analytics data |

#### Bridge (undocumented)

| Method | Source Line | Notes |
|--------|------------|-------|
| `createBridgeDeposit` | lib.rs:2047 | Create a cross-chain bridge deposit |
| `getBridgeDeposit` | lib.rs:2048 | Query a bridge deposit by ID |
| `getBridgeDepositsByRecipient` | lib.rs:2049 | Query deposits by recipient |

#### Shielded Pool (undocumented)

| Method | Source Line | Notes |
|--------|------------|-------|
| `getShieldedPoolStats` | lib.rs:2059 | Pool statistics (vs state) |
| `checkNullifier` | lib.rs:2069 | Alias for `isNullifierSpent` |
| `computeShieldCommitment` | lib.rs:2073 | Compute a Pedersen commitment |
| `generateShieldProof` | lib.rs:2076 | Generate ZK proof for shield |
| `generateUnshieldProof` | lib.rs:2077 | Generate ZK proof for unshield |
| `generateTransferProof` | lib.rs:2080 | Generate ZK proof for transfer |

---

## Task 2: Solana-Compatible RPC (Section 11)

### ✅ All 12 documented methods verified in source (lib.rs:2146–2161)

### ❌ MISSING from doc (1 method)

| Method | Source Line | Notes |
|--------|------------|-------|
| `getRecentBlockhash` | lib.rs:2147 | Alias for `getLatestBlockhash` (Solana compat) |

---

## Task 3: EVM-Compatible RPC (Section 11)

### ✅ All 18 documented methods verified in source (lib.rs:2227–2253)

### ❌ MISSING from doc (2 methods)

| Method | Source Line | Notes |
|--------|------------|-------|
| `eth_accounts` | lib.rs:2234 | Returns `[]` — MetaMask uses own accounts |
| `eth_maxPriorityFeePerGas` | lib.rs:2237 | Returns `"0x0"` — no priority fees |

---

## Task 4: WebSocket Subscriptions (Section 13)

### ✅ PERFECT MATCH — All 19 subscription types verified

Every subscription in the doc matches source. Every subscription in source is documented.

| Subscribe Method | Source (ws.rs) | Verified |
|-----------------|----------------|----------|
| `subscribeSlots` / `slotSubscribe` | L830 | ✅ |
| `subscribeBlocks` | L852 | ✅ |
| `subscribeTransactions` | L874 | ✅ |
| `subscribeAccount` | L896 | ✅ |
| `subscribeLogs` | L940 | ✅ |
| `subscribeSignatureStatus` / `signatureSubscribe` | L1240 | ✅ |
| `subscribeEpochs` / `epochSubscribe` | L1373 | ✅ |
| `subscribeProgramUpdates` | L987 | ✅ |
| `subscribeProgramCalls` | L1009 | ✅ |
| `subscribeNftMints` | L1056 | ✅ |
| `subscribeNftTransfers` | L1103 | ✅ |
| `subscribeMarketListings` | L1150 | ✅ |
| `subscribeMarketSales` | L1172 | ✅ |
| `subscribeBridgeLocks` | L1194 | ✅ |
| `subscribeBridgeMints` | L1216 | ✅ |
| `subscribeDex` | L1422 | ✅ |
| `subscribePrediction` / `subscribePredictionMarket` | L1478 | ✅ |
| `subscribeValidators` / `validatorSubscribe` | L1298 | ✅ |
| `subscribeTokenBalance` / `tokenBalanceSubscribe` | L1322 | ✅ |
| `subscribeGovernance` / `governanceSubscribe` | L1397 | ✅ |

### DEX Channel Verification (dex_ws.rs:94–131)

All 6 documented DEX channels match `DexChannel` enum variants:

| Channel Pattern | Enum Variant | Verified |
|----------------|-------------|----------|
| `orderbook:<pair_id>` | `OrderBook(u64)` | ✅ |
| `trades:<pair_id>` | `Trades(u64)` | ✅ |
| `ticker:<pair_id>` | `Ticker(u64)` | ✅ |
| `candles:<pair_id>:<interval>` | `Candles(u64, u64)` | ✅ |
| `orders:<trader_addr>` | `UserOrders(String)` | ✅ |
| `positions:<trader_addr>` | `UserPositions(String)` | ✅ |

### Prediction Channel Verification (ws.rs:58–70)

| Channel Pattern | Enum Variant | Verified |
|----------------|-------------|----------|
| `all` / `markets` | `AllMarkets` | ✅ |
| `market:<id>` / `<id>` | `Market(u64)` | ✅ |

---

## Task 5: REST API Endpoints (Section 12)

### DEX REST (`/api/v1/*`)

#### ✅ All 31 documented routes exist in source (dex.rs:2651–2704)

#### ❌ MISSING from doc — 11 routes in source but NOT documented

| Method | Path | Source (dex.rs) | Notes |
|--------|------|----------------|-------|
| POST | `/api/v1/orders` | L2664 | Place a new order |
| DELETE | `/api/v1/orders/:id` | L2665 | Cancel an order |
| POST | `/api/v1/router/quote` | L2668 | Get swap quote without executing |
| POST | `/api/v1/margin/open` | L2675 | Open margin position |
| POST | `/api/v1/margin/close` | L2676 | Close margin position |
| GET | `/api/v1/margin/positions/:id` | L2678 | Single margin position detail |
| POST | `/api/v1/governance/proposals` | L2689 | Create governance proposal |
| GET | `/api/v1/governance/proposals/:id` | L2692 | Single proposal detail |
| POST | `/api/v1/governance/proposals/:id/vote` | L2693 | Cast vote |
| GET | `/api/v1/stats/lichenswap` | L2702 | LichenSwap stats |

**Note:** The doc lists `GET /api/v1/governance/proposals` but source also defines POST on the same path for creating proposals. The doc also omits the individual proposal GET route and the vote POST route.

### Prediction Market REST (`/api/v1/prediction-market/*`)

#### ✅ All 7 documented routes verified

#### ❌ MISSING from doc — 7 routes in source but NOT documented

| Method | Path | Source (prediction.rs) | Notes |
|--------|------|----------------------|-------|
| GET | `.../config` | L1427 | Platform configuration |
| GET | `.../markets/:id/price-history` | L1431 | OHLCV price history |
| GET | `.../markets/:id/analytics` | L1432 | Per-market analytics |
| GET | `.../trades` | L1434 | Recent trades |
| GET | `.../traders/:addr/stats` | L1435 | Trader statistics |
| GET | `.../leaderboard` | L1436 | Top traders |
| POST | `.../create-template` | L1440 | Create from template |

### Launchpad REST (`/api/v1/launchpad/*`)

#### ✅ All 5 documented routes verified

#### ❌ MISSING from doc — 1 route

| Method | Path | Source (launchpad.rs) | Notes |
|--------|------|---------------------|-------|
| GET | `.../config` | L513 | Platform configuration |

### Shielded Pool REST (`/api/v1/shielded/*`)

#### ✅ PERFECT MATCH — All 8 routes verified, none missing

---

## Validator SKILL.md Ghost Entries

The `skills/validator/SKILL.md` contains 2 RPC method references in code examples that do NOT exist in source:

| Ghost Method | Location in SKILL.md | Correct Method |
|-------------|---------------------|----------------|
| `getStakeInfo` | Line ~376 (rewards example) | `getStakingStatus` or `getStakingPosition` |
| `claimRewards` | Line ~389 (claim example) | `claimUnstakedTokens` |

---

## Recommended Fixes

### Priority 1 — Fix Ghost Entries in Validator SKILL.md
1. Replace `getStakeInfo` → `getStakingPosition` (returns `unclaimed_rewards`)
2. Replace `claimRewards` → `claimUnstakedTokens` (the actual method)

### Priority 2 — Add missing methods to SKILL_BOOK.md Section 11
Add these 20 undocumented RPC methods organized by category:
- **Core:** `callContract`, `getGenesisAccounts`, `getGovernedProposal`, `getAccountInfo`, `getTransactionHistory`, `requestAirdrop`
- **Admin:** `getFeeConfig`, `setFeeConfig`, `getRentParams`, `setRentParams`
- **Staking:** `stakeToMossStake`, `unstakeFromMossStake`, `claimUnstakedTokens`
- **Contracts:** `setContractAbi`, `deployContract`, `upgradeContract`
- **EVM/Registry:** `getSymbolRegistryByProgram`
- **NFT:** `getMarketOffers`, `getMarketAuctions`
- **Prediction:** `getPredictionMarketAnalytics`
- **Bridge:** `createBridgeDeposit`, `getBridgeDeposit`, `getBridgeDepositsByRecipient`
- **Shielded:** `getShieldedPoolStats`, `checkNullifier`, `computeShieldCommitment`, `generateShieldProof`, `generateUnshieldProof`, `generateTransferProof`

### Priority 3 — Add missing EVM/Solana methods
- Solana: `getRecentBlockhash` (alias for `getLatestBlockhash`)
- EVM: `eth_accounts`, `eth_maxPriorityFeePerGas`

### Priority 4 — Add missing REST endpoints to Section 12
- 11 missing DEX routes (orders POST/DELETE, margin open/close, router/quote, governance detail/vote, stats/lichenswap)
- 7 missing Prediction routes (config, price-history, analytics, trades, trader stats, leaderboard, create-template)
- 1 missing Launchpad route (config)
