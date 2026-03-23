# LICN Tokenomics & Launch Price Analysis

**Date:** February 13, 2026  
**Status:** Historical pre-launch analysis, superseded by the March 2026 blockchain-alignment implementation  
**Decision Required:** Initial LICN launch price + system-wide parameter adjustment

> Historical document: this file preserves pre-alignment launch analysis from February 2026.
> The live chain now uses a 500M LICN genesis supply, protocol inflation that settles at epoch boundaries,
> and explorer/RPC projections that can appear mid-epoch before on-chain settlement finalizes.

---

## Table of Contents

1. [Current State of the Code](#1-current-state-of-the-code)
2. [Emission & Burn Math](#2-emission--burn-math)
3. [The Core Problem](#3-the-core-problem)
4. [Launch Price Scenarios](#4-launch-price-scenarios)
5. [Recommended Launch Price](#5-recommended-launch-price)
6. [Full System Parameter Readjustment](#6-full-system-parameter-readjustment)
7. [Genesis Distribution Conflict](#7-genesis-distribution-conflict)
8. [Other Discrepancies to Fix](#8-other-discrepancies-to-fix)

---

## 1. Historical Snapshot (February 2026)

### Supply

| Parameter | Value |
|-----------|-------|
| Genesis Supply | **500,000,000 LICN** (500 million) |
| Decimals | **9** (1 LICN = 1,000,000,000 spores) |
| Mintable | **Yes** — protocol inflation settles at epoch boundaries |
| Burnable | **Yes** — 40% of all transaction fees burned |

### Genesis Distribution (multisig.rs — canonical)

| Wallet | LICN | % | Purpose |
|--------|------|---|---------|
| Validator Rewards | 50,000,000 | 10% | Legacy reserve wallet, not the canonical live staking reward source |
| Community Treasury | 125,000,000 | 25% | Governance-allocated spending |
| Builder Grants | 175,000,000 | 35% | Developer incentives |
| Founding Symbionts | 50,000,000 | 10% | Team / founding agents |
| Ecosystem Partnerships | 50,000,000 | 10% | Partnerships, integrations |
| Reserve Pool | 50,000,000 | 10% | Emergency reserve |

### Historical Reward-Rate Assumptions

> Historical note: the reward-rate tables below reflect the February 2026 launch-price model.
> The live chain now uses epoch-settled inflation minting, and explorer/RPC may show projected mid-epoch reward
> values before canonical settlement.

| Reward Type | Amount per event | In spores |
|-------------|-----------------|-----------|
| Transaction block reward | **0.1 LICN** per block | 100,000,000 |
| Heartbeat block reward | **0.05 LICN** per empty block | 50,000,000 |
| Slots per year | 78,840,000 (~400ms slots) | — |
| Code: `ANNUAL_REWARD_DECAY_BPS` | 2000 (20%) | — |

### Fee Structure

| Fee | Amount | At $0.10/LICN |
|-----|--------|---------------|
| Base transaction fee | **0.001 LICN** per tx (1,000,000 spores) | $0.0001 |
| Contract deploy | **25 LICN** per deploy | $2.50 |
| Contract upgrade | **10 LICN** per upgrade | $1.00 |
| NFT mint | **0.5 LICN** per mint | $0.05 |
| NFT collection create | **1,000 LICN** per collection | $100.00 |
| SporePump token create | **0.1 LICN** per token | $0.01 |
| DAO proposal stake | **1,000 LICN** (returned after vote) | $100.00 |

### Fee Distribution

| Destination | % |
|-------------|---|
| **Burned** | 40% |
| Block producer | 30% |
| Voter validators | 10% |
| Community treasury | 10% |
| Community pool | 10% |

---

## 2. Emission & Burn Math

### Validator Reward Emission

Assuming ~400ms slots, 78.84M slots/year:

**Scenario A — High activity (50% blocks have transactions):**
- TX blocks: 39.42M × 0.1 LICN = **3,942,000 LICN/year**
- Empty blocks: 39.42M × 0.05 LICN = **1,971,000 LICN/year**
- **Total emission: ~5,913,000 LICN/year** (~0.59% of supply)

**Scenario B — Low activity (10% blocks have transactions):**
- TX blocks: 7.884M × 0.1 LICN = **788,400 LICN/year**
- Empty blocks: 70.956M × 0.05 LICN = **3,547,800 LICN/year**
- **Total emission: ~4,336,200 LICN/year** (~0.43% of supply)

**Scenario C — Maximum activity (100% blocks have transactions):**
- TX blocks: 78.84M × 0.1 LICN = **7,884,000 LICN/year**
- **Total emission: ~7.9M LICN/year** (~0.79% of supply)

> **Note:** With adaptive heartbeat (5s interval instead of 400ms), actual heartbeat
> block emission is ~12.5x lower than shown. At 5s intervals, heartbeat blocks/year ≈ 6.3M
> (not 39-71M), so real-world heartbeat emission in Scenario B is closer to 315K LICN/year.

### Reward Pool Depletion

The validator reward pool is **100,000,000 LICN** (10% of supply).

| Activity Level | Annual Emission | Years Until Depleted |
|---------------|----------------|---------------------|
| Low (10% tx) | 4.3M LICN/yr | **~23 years** |
| Medium (50% tx) | 5.9M LICN/yr | **~17 years** |
| High (100% tx) | 7.9M LICN/yr | **~12.7 years** |

> **Note:** These are theoretical maximums at base reward rates. In practice, the
> price-based reward adjustment (oracle) reduces emissions as LICN price rises
> above $0.10, and adaptive heartbeat reduces empty-block emissions by ~12.5x.

### Fee Burn Estimation

For burn to matter, we need transaction volume. At 0.001 LICN base fee:

| Daily Transactions | Fee Burned/Day | Annual Burn |
|-------------------|---------------|-------------|
| 100,000 | 40 LICN | 14,600 LICN |
| 1,000,000 | 400 LICN | 146,000 LICN |
| 10,000,000 | 4,000 LICN | 1,460,000 LICN |
| 100,000,000 | 40,000 LICN | 14,600,000 LICN |

**At the current 0.001 LICN base fee ($0.0001/tx at $0.10), burn is meaningful at scale.** 10M tx/day burns 1.46M LICN/year (0.15% of supply). Combined with larger fees (contract deploys at 25 LICN, NFT collections at 1,000 LICN, DEX trading fees), the deflationary mechanic becomes substantial.

### DEX Rewards Emission

**dex_rewards: 100,000 LICN/month = 1,200,000 LICN/year**

At 100,000 LICN/month (1.2M/year), this is sustainable. If sourced from builder grants (350M), it lasts ~292 years. If sourced from the validator rewards pool (100M), it lasts ~83 years alongside block rewards.

**This needs a source wallet defined clearly.** Currently the reward claim doesn't even transfer tokens.

---

## 3. The Core Problem

### There's no exchange, no liquidity, no market price

We're bootstrapping from zero. The initial price is a **design decision**, not a market-discovered value. Every fee, every reward, and every cost in the system is denominated in LICN, so the initial price determines:

1. **Is 0.00001 LICN per tx too cheap or too expensive?**
2. **Historical assumption: was a 0.1 LICN per-block-style reward sustainable?**
3. **Is 2.5 LICN to deploy a contract reasonable?**
4. **Is 1,000 LICN to stake a DAO proposal accessible?**
5. **Is 100 LICN for an NFT collection a fair barrier?**

### What the price means in practice

| LICN Price | Base Fee (USD) | Block Reward (USD) | Deploy Cost (USD) | DAO Stake (USD) | Collection (USD) |
|-----------|---------------|-------------------|-------------------|----------------|-----------------|
| $0.001 | $0.00000001 | $0.0001 | $0.0025 | $1.00 | $0.10 |
| $0.01 | $0.0000001 | $0.001 | $0.025 | $10.00 | $1.00 |
| **$0.05** | $0.0000005 | $0.005 | $0.125 | $50.00 | $5.00 |
| **$0.10** | $0.000001 | $0.01 | $0.25 | $100.00 | $10.00 |
| $0.50 | $0.000005 | $0.05 | $1.25 | $500.00 | $50.00 |
| $1.00 | $0.00001 | $0.10 | $2.50 | $1,000.00 | $100.00 |
| $5.00 | $0.00005 | $0.50 | $12.50 | $5,000.00 | $500.00 |
| $10.00 | $0.0001 | $1.00 | $25.00 | $10,000.00 | $1,000.00 |

---

## 4. Launch Price Scenarios

### Scenario A: $0.01 (Penny Launch)

| Metric | Value |
|--------|-------|
| Fully Diluted Valuation (FDV) | **$10,000,000** |
| Transaction fee | $0.00001 (near-free) |
| Block reward | $0.001/block (~$79K/yr at 100% activity) |
| Contract deploy | $0.25 (dirt cheap) |
| DAO proposal | $10 (very accessible) |
| DEX reward pool | $12K/yr in emissions |
| SporePump token | $0.001 to create (spam risk) |
| **Assessment** | Too cheap. Spam attacks trivial. DAO governance meaningless. Block rewards don't justify running a validator. |

### Scenario B: $0.10 (Dime Launch)

| Metric | Value |
|--------|-------|
| Fully Diluted Valuation (FDV) | **$100,000,000** |
| Transaction fee | $0.0001 (sub-penny, agent-friendly) |
| Block reward | $0.01/block (~$790K/yr at 100%) |
| Contract deploy | $2.50 (very affordable) |
| DAO proposal | $100 (moderate barrier) |
| DEX reward pool | $120K/yr emissions (~reasonable) |
| SporePump token | $0.01 to create (cheap but not free) |
| Founding Symbionts holding | $10M |
| **Assessment** | Reasonable starting point. Cheap enough for agents/developers. Revenue to team through founding allocation. FDV is credible for a working L1. |

### Scenario C: $0.50 (Premium Launch)

| Metric | Value |
|--------|-------|
| Fully Diluted Valuation (FDV) | **$500,000,000** |
| Transaction fee | $0.0005 (sub-penny) |
| Block reward | $0.05/block (~$3.9M/yr at 100%) |
| Contract deploy | $12.50 (fair) |
| DAO proposal | $500 (significant barrier) |
| DEX reward pool | $600K/yr emissions |
| SporePump token | $0.05 to create |
| Founding Symbionts holding | $50M |
| **Assessment** | Ambitious but defensible if tech delivers. Higher barrier for degen spam. DAO becomes serious. Need to deliver to justify this FDV. |

### Scenario D: $1.00 (Dollar Launch)

| Metric | Value |
|--------|-------|
| Fully Diluted Valuation (FDV) | **$1,000,000,000** |
| Transaction fee | $0.001 (still very cheap) |
| Block reward | $0.10/block (~$7.9M/yr at 100%) |
| Contract deploy | $25.00 (reasonable) |
| DAO proposal | $1,000 (high barrier) |
| NFT collection | $1,000.00 (serious) |
| SporePump token | $0.10 to create |
| Founding Symbionts holding | $100M |
| **Assessment** | Comparable to mid-cap L1s at launch. Very ambitious. Forces high DAO seriousness. Risk: if price drops significantly, FDV collapse hits credibility. |

---

## 5. Recommended Launch Price

### $0.10 per LICN

**Why $0.10:**

1. **Fair FDV ($100M)** — credible for a working L1 blockchain with full DEX, lending, NFT marketplace, cross-chain bridge, governance, identity, oracle, and 26 deployed contracts

2. **Agent-friendly fees** — transaction fee is $0.0001 (sub-penny), so agents can transact millions of times affordably. Gas is never a blocker.

3. **Meaningful governance** — DAO proposal at $100 prevents spam but isn't exclusionary. DEX governance listing at $50 rep barrier makes sense.

4. **Sustainable validator economics** — At 50% activity with oracle adjustment: rewards scale with price. At $0.10 reference price, validators earn meaningful revenue split among all active validators. As LICN price rises, reward rate adjusts down automatically.

5. **Revenue for the team** — Founding Symbionts allocation (100M LICN) = $10M initial value. Ecosystem partnerships (100M) = $10M. Fair compensation for building a working L1.

6. **Growth ceiling** — 10x to $1.00 (= $1B FDV) is achievable with adoption. Still room to run to $10+ with massive adoption, which would be a $10B FDV (comparable to established L1s like Avalanche, Near).

7. **SporePump is cheap but not free** — Token creation at $0.01 prevents mindless spam but keeps experimentation alive. Graduation at 100K LICN = $10K market cap = achievable milestone that's still meaningful.

8. **DEX fee economics** — Taker fee of 5bps (0.05%) of a $1000 trade = $0.50. With 40% burn, $0.20 burned per $1000 traded. At $10M daily volume, $1,000/day burned = 365K LICN/year burned. This starts making the deflationary mechanic real.

### But: Does _anything_ need readjusting at $0.10?

| Parameter | Current | At $0.10 | Verdict |
|-----------|---------|----------|---------|
| Base tx fee | 0.001 LICN | $0.0001 | OK — sub-penny, agent-friendly |
| Block reward (tx) | 0.1 LICN | $0.01/block | OK — oracle adjusts down as price rises |
| Block reward (heartbeat) | 0.05 LICN | $0.005/block | OK — 50% of tx reward, adaptive 5s interval |
| Contract deploy | 25 LICN | $2.50 | OK — affordable, not free |
| Contract upgrade | 10 LICN | $1.00 | OK |
| NFT mint | 0.5 LICN | $0.05 | OK — cheap, not free |
| NFT collection | 1,000 LICN | $100.00 | OK — meaningful barrier for collection spam |
| SporePump create | 0.1 LICN | $0.01 | **Maybe too cheap** — consider 1 LICN ($0.10) |
| DAO proposal stake | 1,000 LICN | $100.00 | OK — serious but not exclusionary |
| SporePump graduation | 100K LICN | $10,000 | OK — agent-friendly, bonding curve still filters spam |
| Max order (DEX) | 1,000 LICN | $100 | **Too low** — should be higher for serious trading |
| DEX rewards | 100K LICN/mo | $10K/month | **Needs assessment** — that's $120K/yr from a finite pool |
| Min validator stake | 75,000 LICN | $7,500 | OK — accessible (bootstrap grant is 100K, 25K buffer) |
| Max validator stake | 1,000,000 LICN | $100,000 | OK — prevents over-concentration |

### Parameters that need adjustment at $0.10:

1. **`MAX_ORDER_SIZE` in dex_core** — Currently 1,000 LICN = $100. For a proper DEX, this should be much higher (e.g., 10,000,000 LICN = $1M max order). This is the max _per order_, not per position.

2. **`REWARD_POOL_PER_MONTH` in dex_rewards** — 100K LICN/month = $10K/month = $120K/yr. Combined with block rewards, the reward pool depletion depends heavily on network activity and LICN price (oracle adjustment). The price-based reward adjustment means higher LICN prices automatically reduce emission, extending the runway.

3. **`CREATION_FEE` in sporepump** — 0.1 LICN = $0.01 is probably too cheap. At $0.01, bots will spam thousands of meme tokens. Consider raising to 1-10 LICN ($0.10-$1.00) to add friction.

4. **`DEFAULT_MAX_BUY_AMOUNT` in sporepump** — 10,000 LICN = $1,000 max buy. This is reasonable as an anti-whale measure on bonding curves.

---

## 6. Full System Parameter Readjustment

### At $0.10/LICN, these are the recommended changes:

| Parameter | File | Current | Proposed | Rationale |
|-----------|------|---------|----------|-----------|
| `MAX_ORDER_SIZE` | dex_core/lib.rs | 1,000 LICN | **10,000,000 LICN** ($1M) | Proper DEX needs large orders |
| `CREATION_FEE` | sporepump/lib.rs | 0.1 LICN | **10 LICN** ($1.00) | Anti-spam, still accessible |
| `REWARD_POOL_PER_MONTH` | dex_rewards/lib.rs | 100,000 LICN | **100,000 LICN** ($10K/mo) | More sustainable, extends pool life |
| `MIN_LISTING_LIQUIDITY` | dex_governance/lib.rs | 10 LICN | **10,000 LICN** ($1K) | Match the comment, prevent dust listings |

### Parameters that are fine as-is:

| Parameter | Value at $0.10 | Verdict |
|-----------|---------------|---------|
| Base tx fee ($0.0001) | Sub-penny, agent-friendly | Perfect for agents |
| Block reward ($0.01/block) | Meaningful but not excessive | Good |
| Contract deploy ($2.50) | Very affordable | Good |
| DAO proposal ($100) | Serious but fair | Good |
| Validator stake min ($1,000) | Accessible | Good |
| Validator stake max ($10,000) | Prevents concentration | Good |
| Taker fee 5bps (0.05%) | Competitive with Binance/Coinbase | Good |
| Maker rebate -1bp (-0.01%) | Attracts liquidity | Good |
| Lending LTV 75% | Industry standard | Good |
| Flash loan fee 0.09% | Matches Aave | Good |
| Marketplace fee 2.5% | Standard for NFTs | Good |

---

## 7. Genesis Distribution Conflict

**There are TWO different distributions in the code:**

### multisig.rs (used by validator code — CANONICAL)

```
validator_rewards:      100,000,000  (10%)
community_treasury:     250,000,000  (25%)
builder_grants:         350,000,000  (35%)
founding_symbionts:        100,000,000  (10%)
ecosystem_partnerships: 100,000,000  (10%)
reserve_pool:           100,000,000  (10%)
```

### genesis.rs (different names + different amounts)

```
Community Treasury:        250,000,000  (25%)  ← matches
Validator Rewards Pool:    100,000,000  (10%)  ← matches
Development Fund:          350,000,000  (35%)  ← matches builder_grants
Ecosystem Growth:          100,000,000  (10%)  ← matches founding_symbionts
Foundation Reserve:        100,000,000  (10%)  ← matches reserve_pool
Early Contributors:        100,000,000  (10%)  ← matches ecosystem_partnerships
```

**The validator code uses `REWARD_POOL_LICN = 100,000,000` from multisig.rs.** This means the actual validator rewards pool is 100M, which is what `genesis_auto_deploy` uses.

**Resolution needed:** Align genesis.rs to match multisig.rs, or vice versa. The names and amounts must be consistent. The whitepaper/website should match exactly.

---

## 8. Other Discrepancies to Fix

### 1. Slashing: Downtime Penalty

- `genesis.rs`: 5% flat
- `consensus.rs apply_economic_slashing()`: 1% per 100 missed slots, max 10%
- **Recommendation:** Use the graduated approach from consensus.rs. Update genesis.rs feature flags to match.

### 2. DEX Governance Listing Liquidity

- Code: `MIN_LISTING_LIQUIDITY = 10_000_000_000` spores = 10 LICN
- Comment: "10,000 LICN equivalent"
- **Fix:** Change to `10_000_000_000_000` (10,000 LICN) to match the comment. At $0.10, that's $1,000 minimum liquidity to list a token — reasonable.

### 3. DEX Rewards Source Wallet

- `REWARD_POOL_PER_MONTH` is defined but there's no defined source wallet
- Rewards claims don't actually transfer tokens
- **Fix (in DEX milestone):** Define that dex_rewards draws from the `builder_grants` wallet (350M LICN), not validator rewards. Builder grants purpose = incentivize ecosystem growth, which trading rewards accomplish.

### 4. `ANNUAL_REWARD_DECAY_BPS = 2000`

The code uses a 20% annual reward decay constant. In the live chain, LICN is inflationary with fee-burn counter-pressure: staking issuance is minted by protocol at epoch boundaries rather than drawn from a pre-allocated reward pool.

- **Superseded by alignment:** `ANNUAL_REWARD_DECAY_BPS = 2000` now governs protocol inflation decay. New LICN is minted only when epoch-boundary settlement executes, while explorer and RPC may expose projected intra-epoch values for operator visibility.

---

## Decision Matrix

After choosing the $0.10 price, the following parameters need code changes:

| # | Change | File | Priority |
|---|--------|------|----------|
| 1 | `MAX_ORDER_SIZE` → 10M LICN | contracts/dex_core/src/lib.rs | Medium |
| 2 | `CREATION_FEE` → 10 LICN | contracts/sporepump/src/lib.rs | Medium |
| 3 | `REWARD_POOL_PER_MONTH` → 100K LICN | contracts/dex_rewards/src/lib.rs | Medium |
| 4 | `MIN_LISTING_LIQUIDITY` → 10K LICN | contracts/dex_governance/src/lib.rs | Medium |
| 5 | Align genesis.rs distribution to multisig.rs | core/src/genesis.rs | **High** |
| 6 | ~~Rename `ANNUAL_INFLATION_BPS`~~ **Done → `ANNUAL_REWARD_DECAY_BPS`** | core/src/consensus.rs | ✅ Done |
| 7 | Define reward source: builder_grants wallet | contracts/dex_rewards/src/lib.rs | **High** |
| 8 | Fix slashing discrepancy | core/src/genesis.rs | Low |

These changes become **Task 0** in the DEX Completion Milestone — run before Phase 1.
