# Lichen Staking System Roadmap
**Aligned with VISION.md and WHITEPAPER.md**

> Live-chain note: this roadmap contains staged staking design work. The canonical deployed economics are 500M LICN at genesis,
> protocol inflation that settles at epoch boundaries, and explorer/RPC projections that may appear mid-epoch before on-chain settlement.

## Overview

Lichen implements a **three-phase staking system** designed for agent economies with human participation:

1. **Phase 1 (✅ LIVE)**: Validator Bootstrap Grants
2. **Phase 2 (📋 PLANNED)**: Liquid Staking & Delegation (MossStake Protocol)
3. **Phase 3 (🔮 FUTURE)**: Advanced DeFi Integration

---

## Phase 1: Validator Bootstrap Grants (CURRENT)

### Status: ✅ IMPLEMENTED

**Purpose**: Enable zero-capital validator onboarding to maximize decentralization

**Implementation**: `core/src/consensus.rs::StakePool`

### How It Works

1. **Bootstrap Grant**: New validators receive **100,000 LICN** automatically
   - No upfront capital required
   - Debt recorded in `bootstrap_debt` field
   - Validator operates immediately

2. **Vesting Through Work**: Validators repay debt through settled epoch rewards
  - Each epoch settlement can reduce bootstrap debt
   - 100% repayment = "Graduation" = fully vested
   - Validator owns 100% of stake after graduation

3. **Account Creation**: 
   - Code: `validator/src/main.rs` (lines 242-254)
   - Creates validator account with 100K LICN on first startup
   - Auto-increments global account counter

### Economic Impact

- **Bootstrap Grants**: up to 200 validators × 100K LICN = 20M LICN maximum bootstrap exposure
- **Validator Allocation**: bootstrap grants come from genesis allocations, not a standalone live reward pool
- **Unlock Timeline**: Vests as validators earn rewards (organic distribution)

### Current Limitations

- ❌ No delegation mechanism (validators can't accept external stake)
- ❌ No liquid staking (stake is locked while validating)
- ❌ No staking rewards for non-validators
- ❌ No APY system for passive stakers

**These features come in Phase 2.**

---

## Phase 2: Liquid Staking & Delegation (PLANNED)

### Status: 📋 CODE EXISTS BUT NOT ACTIVATED

**Purpose**: Allow anyone (agents/humans) to stake LICN and earn rewards

**Implementation**: `core/src/mossstake.rs` (partially implemented)

### MossStake Protocol

**For Stakers (Anyone):**
```rust
// Stake LICN → Receive stLICN (liquid staking receipt token)
fn stake(licn_amount: u64) -> Result<u64, String> {
    // 1. Lock user's LICN in protocol
    // 2. Mint stLICN at exchange rate
    // 3. User receives stLICN (tradeable, usable in DeFi)
}

// Unstake stLICN → Receive LICN (after 7 day unbonding)
fn unstake(st_licn_amount: u64) -> Result<(), String> {
    // 1. Burn stLICN
    // 2. Start 7-day unbonding timer
    // 3. Release LICN after cooldown
}
```

**For Validators (Delegation):**
```rust
// Validators configure commission rate
validator.set_commission(0.10); // 10% to validator, 90% to delegators

// Delegators choose validator
fn delegate_to_validator(validator: Pubkey, amount: u64) -> Result<(), String> {
    // 1. Stake LICN with specific validator
    // 2. Receive stLICN
    // 3. Earn rewards proportional to stake
    // 4. Inherit validator's reputation multiplier
}
```

### Reward Distribution Example

**Scenario**: Validator Alice has fully graduated

```
Alice's Stats:
  Own stake:        100,000 LICN (from bootstrap, fully vested)
  Delegated stake:  40,000 LICN (from community)
  Total stake:      140,000 LICN
  Commission:       10%

Illustrative settled reward slice: 0.02 LICN

Distribution:
  Alice:      0.002 LICN (10% commission)
  Delegators: 0.018 LICN (split proportionally by stake)
    - Bob (20K LICN): 0.009 LICN (50% of delegation)
    - Carol (10K LICN): 0.0045 LICN (25% of delegation)
    - Dave (10K LICN): 0.0045 LICN (25% of delegation)
```

### APY Calculation

**Illustrative APY Formula**:
```
Annual Rewards ≈ (Projected annualized epoch issuance × Your stake) / Total staked
APY = (Annual Rewards / Your stake) × 100%

Example (assuming $0.10/LICN):
- Total staked: 50M LICN (10% of genesis supply)
- Your stake: 100,000 LICN
- Projected annual issuance: ~20,000,000 LICN at the 4% year-0 rate
- Annual rewards: 20,000,000 × (100,000 / 50,000,000) = 40,000 LICN before commission and vesting effects
- APY: (40,000 / 100,000) × 100% = 40%
```

Explorer and RPC may show mid-epoch projections, but canonical reward settlement occurs only when the epoch boundary executes.

**Variables Affecting APY**:
- Total amount staked (↑ stake = ↓ APY)
- Your validator's performance (↑ uptime = ↑ settled rewards)
- Current inflation curve and epoch completion
- Bootstrap graduation state for grant-backed validators

**Target APY Range**: 5-15% initially, market-driven long-term

### Implementation Checklist

**Core Protocol**:
- [x] MossStake smart contract skeleton (`core/src/mossstake.rs`)
- [ ] Exchange rate calculation (stLICN:LICN ratio)
- [ ] Reward accumulation tracking
- [ ] Unbonding queue (7-day cooldown)
- [ ] Auto-compounding logic

**Validator Integration**:
- [x] StakePool exists (`core/src/consensus.rs`)
- [ ] Commission rate configuration
- [ ] Delegation acceptance logic
- [ ] Proportional reward splitting
- [ ] Minimum delegation amount (prevent spam)

**RPC Endpoints**:
- [ ] `stakeToMossStake(amount)` - Stake LICN
- [ ] `unstakeFromMossStake(amount)` - Initiate unstaking
- [ ] `claimUnstakedTokens()` - Claim after cooldown
- [ ] `delegateToValidator(validator, amount)` - Delegate to specific validator
- [ ] `getStakingAPY()` - Real-time APY calculation
- [ ] `getMyStakingInfo()` - User's staking balances/rewards

**UI Components** (Wallet):
- [ ] Staking dashboard (all users)
- [ ] Validator selection UI (browse validators by APY/reputation)
- [ ] Stake/unstake forms
- [ ] Rewards display (earned, pending, claimed)
- [ ] Unbonding timer display

### Migration Plan

**Prerequisites**:
1. ✅ All validators graduated (bootstrap debt = 0)
2. ✅ Minimum 50 active validators (decentralization)
3. ✅ 30-day mainnet stability (no consensus issues)
4. ⏳ DAO governance vote (66% supermajority)

**Activation Sequence**:
1. Deploy MossStake program to mainnet
2. Publish stLICN token contract
3. Enable delegation in validator software
4. Launch staking UI in wallet
5. Announce to community

**Timeline**: Q2 2026 (after 3 months of mainnet stability)

---

## Phase 3: Advanced DeFi Integration (FUTURE)

### Status: 🔮 CONCEPTUAL (WHITEPAPER SPEC)

**Purpose**: Make staked assets productive in DeFi

### Planned Features

**1. stLICN as DeFi Collateral**
- Use stLICN in ThallLend (lending protocol)
- Borrow stablecoins against stLICN
- Leverage staking yields

**2. stLICN Liquidity Pools**
- stLICN/LICN pool on SporeSwap (DEX)
- Earn trading fees + staking rewards
- Instant liquidity for unstaking (vs 7-day wait)

**3. Auto-Compounding Vaults**
- SporeVault aggregates staking + DeFi yields
- Automated strategy optimization
- Agent-managed rebalancing

**4. Flash Unstaking**
- Instant unstake via liquidity pool swap
- Small premium paid to LPs
- No 7-day wait

**5. Synthetic Staking Derivatives**
- Long/short staking yields
- Options on APY
- Yield swaps between validators

### Implementation Timeline

- **Q3 2026**: stLICN as collateral
- **Q4 2026**: Liquidity pools & flash unstaking
- **Q1 2027**: Auto-compounding vaults
- **Q2 2027**: Synthetic derivatives

---

## Economic Modeling

### Total Staking Capacity

```
Maximum Staked: 500,000,000 LICN (100% of genesis supply before minted expansion)
Realistic Staked: 50,000,000 - 150,000,000 LICN (10-30%)
  
Why not 100%?
- Need liquid LICN for transactions
- Trading on exchanges
- DeFi liquidity pools
- Working capital for agents
```

### APY Dynamics

**High Staking Ratio (>50% staked)**:
- Lower APY (more competition for rewards)
- More secure network (higher stake = harder to attack)
- Less liquid LICN (potential price pressure upward)

**Low Staking Ratio (<10% staked)**:
- Higher APY (fewer participants splitting rewards)
- Encourages more staking
- More liquid LICN for DeFi/trading

**Self-Balancing**: Market finds equilibrium APY where staking opportunity cost = DeFi/trading yields

### Price Impact of Staking

**Deflationary Pressure**:
- Staked LICN locked (reduced circulating supply)
- 40% of fees burned (permanent reduction)
- Combined effect: Strong upward price pressure

**Example (updated to live 500M genesis framing):**
```
Day 1:
- 500M LICN genesis supply
- 100M staked (10%)
- 400M circulating

Day 365 (active network):
- 500M + settled inflation - burned fees
- 200M staked (20%, doubled)
- 5M burned from fees (0.5% deflation)
- circulating supply depends on epoch-settled minting and burn

Result: live circulating supply is dynamic and must be evaluated as genesis + minted - burned.
```

---

## Current Status Summary

### What's LIVE (Phase 1)

✅ Validator bootstrap grants (100K LICN each)
✅ Vesting system (repay debt through rewards)
✅ Account counter (tracks all accounts)
✅ Graduation tracking (bootstrap_debt = 0)

### What's MISSING (Phase 2 - Critical)

❌ Regular staking for non-validators (MossStake Protocol)
❌ Delegation system (stake with validators)
❌ APY display/calculation in wallet
❌ Unbonding queue (7-day cooldown)
❌ stLICN liquid staking token

### What's FUTURE (Phase 3)

🔮 stLICN as DeFi collateral
🔮 Liquidity pools for instant unstaking
🔮 Auto-compounding yield vaults
🔮 Synthetic staking derivatives

---

## Action Items

### Immediate (Week 1)

1. ✅ Update wallet UI to show Phase 1 only for validators
2. ✅ Add "Staking Coming Soon" banner for regular users
3. ✅ Document staking roadmap (this file)
4. ⏳ Add staking section to ECONOMICS.md

### Short Term (Month 1)

1. Implement MossStake core protocol
2. Add RPC endpoints for staking operations
3. Update validator software to accept delegations
4. Build staking UI in wallet (separate from validator bootstrap)

### Medium Term (Month 2-3)

1. Internal testnet for staking (simulated APY)
2. Security audit of staking contracts
3. Performance testing (1000+ delegators)
4. Documentation for delegators

### Long Term (Month 4+)

1. DAO vote for staking activation
2. Mainnet deployment of MossStake
3. Community education campaign
4. Monitor APY dynamics & adjust parameters if needed

---

## Key Takeaways

1. **Validator Bootstrap (Phase 1)** = Already live, working as intended
2. **Public Staking (Phase 2)** = Critically needed, code exists but not integrated
3. **Advanced DeFi (Phase 3)** = Future enhancement, not blocking launch
4. **VISION Alignment** = All phases support agent economic independence
5. **Timeline** = Phase 2 within 1-2 months, Phase 3 within 6-12 months

**Bottom Line**: We have validator staking working. We need public staking ASAP to enable community participation and align with Vision/Whitepaper promises.
