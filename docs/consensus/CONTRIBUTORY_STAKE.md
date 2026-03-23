# Contributory Stake: The Self-Made Symbiont System
## Earn Your Stake Through Work, Not Wealth

**Version:** 1.0.0  
**Date:** February 7, 2026  
**Status:** Historical design overview with live bootstrap vesting concepts  
**Philosophy:** Contribution > Capital 🦞⚡

> Live-chain note: bootstrap debt repayment still exists, but validator rewards now settle through epoch-boundary inflation and fee-share accounting.
> Treat the literal per-block reward numbers in older examples as historical design math, not the current deployed payout surface.

---

## The Problem with Traditional Proof of Stake

**Capital Barriers:**
- Solana: Requires 1 SOL (~$100) minimum
- Ethereum: Requires 32 ETH (~$50,000+)
- Cosmos: Varies by chain,typically 10-10,000 tokens

**Result:** Only wealthy actors can validate. Plutocracy, not meritocracy.

**The Lichen Solution:**
- **Zero capital required** to start validating
- **Earn your stake** through contribution
- **Settled rewards become liquid** while bootstrap debt is repaid automatically
- **Graduation timing depends on epoch-settled rewards, uptime, and fee flow**

---

## How Contributory Stake Works

### Phase 1: Bootstrap (Day 0)

When a validator starts:

```rust
StakeInfo {
    validator: <your_pubkey>,
    amount: 100_000_000_000_000,        // 100,000 LICN (bootstrap stake)
    earned_amount: 0,                   // None earned yet
    bootstrap_debt: 100_000_000_000_000, // Must repay through work
    is_active: true,                    // Can validate immediately
    delegated_amount: 0,                // No delegations yet
    rewards_earned: 0,                  // No rewards yet
    last_reward_slot: 0,
    status: BootstrapStatus::Bootstrapping,
}
```

**Key Points:**
- ✅ 100,000 LICN bootstrap stake granted automatically
- ✅ Can validate blocks immediately
- ✅ Bootstrap debt is repaid from settled validator rewards
- ✅ NON-NEGOTIABLE: 100,000 LICN minimum (network security)
- ✅ Cannot be edited, reduced, or bypassed
- ✅ Verified cryptographically on-chain

### Phase 2: Earning (Days 1-86)

Rewards accrue through epoch-settled inflation plus validator fee share:

**Live reward signals:**
```rust
Transaction fees: earned when your validator produces blocks
Epoch inflation: distributed to active stake when the epoch boundary settles
```

**Automatic 50/50 Split:**
```rust
fn claim_rewards(&mut self) -> (u64, u64) {
    let total_reward = self.rewards_earned;
    
    if self.bootstrap_debt > 0 {
        // Split 50/50: debt repayment vs liquid
        let debt_payment = total_reward / 2;
        let liquid = total_reward - debt_payment;
        
        // Apply debt payment (capped at remaining debt)
        let paid = debt_payment.min(self.bootstrap_debt);
        self.bootstrap_debt -= paid;
        self.earned_amount += paid;
        
        return (liquid, paid); // (spendable, locked_for_debt)
    } else {
        // Fully vested: 100% liquid
        return (total_reward, 0);
    }
}
```

**Example After 100 Heartbeat Blocks:**
```
Blocks produced:    100
Total earned:       5.0 LICN (100 × 0.05)
Debt repayment:     2.5 LICN (locked, applied to debt)
Liquid balance:     2.5 LICN (spendable now!)

Bootstrap debt:     100,000 - 2.5 = 99,997.5 LICN
Earned stake:       2.5 LICN (real, not virtual)
Progress:           0.0025% vested
```

### Phase 3: Graduation (Debt = 0)

When `bootstrap_debt` reaches zero:

```rust
StakeInfo {
    validator: <your_pubkey>,
    amount: 100_000_000_000_000,         // 100,000 LICN (still)
    earned_amount: 100_000_000_000_000,  // 100,000 LICN EARNED!
    bootstrap_debt: 0,                  // DEBT PAID! 🎉
    is_active: true,
    delegated_amount: <community_delegations>,
    rewards_earned: 0,
    last_reward_slot: <current>,
    status: BootstrapStatus::FullyVested,
}
```

**Graduation Benefits:**
- ✅ **100% liquid rewards** - No more 50/50 split
- ✅ **Accept delegations** - Community can delegate to you
- ✅ **"Self-Made Symbiont" badge** - On-chain achievement
- ✅ **Graduation NFT** - Commemorative token minted
- ✅ **Founding Validator** status (if in first 1000)
- ✅ **Reputation boost** - +100 reputation score
- ✅ **Dashboard updated** - Status changes to "Fully Vested"

---

## Timeline to Full Vesting

### Single Validator (Illustrative Live Economics)

```
Bootstrap debt repayment depends on:
- active-stake share at each epoch boundary
- validator uptime (for the accelerated repayment path)
- transaction-fee share from produced blocks

Result: graduation is driven by settled epoch rewards, not a fixed per-block clock.
```

### Multiple Validators

```
More validators: reward share is diluted across more active stake.
Better uptime:   bootstrap debt can repay faster through the bonus path.
More fee flow:   block-producer fee share increases liquid earnings.
```

### Active Network (With Transactions)

```
Higher transaction volume increases validator fee share and can accelerate
bootstrap graduation, but the canonical settlement still happens at epoch boundaries.
```

---

## Gamification & Achievements

### Achievement System

**Core Badges:**
```
🦞 Self-Made Symbiont
   Requirement: Fully vest 100,000 LICN bootstrap debt
   Reward: +100 reputation, NFT minted
   
🏆 Founding Validator
   Requirement: Be in first 100 validators
   Reward: +200 reputation, governance power, historical significance
   
⚡ Speed Vester
   Requirement: Fully vest in <30 days
   Reward: +50 reputation, "Speed" badge
   
💎 Diamond Spores
   Requirement: 100% uptime during entire vesting period
   Reward: +150 reputation, "Reliability" bonus
   
🌊 Moss Builder
   Requirement: Produce 1,000+ blocks
   Reward: +75 reputation, "Builder" badge
   
🎯 Precision Producer
   Requirement: 99.9% uptime, 0 slashing events
   Reward: +100 reputation, "Precision" badge
   
🔥 Burn Boss
   Requirement: Top 10% in transaction fees burned
   Reward: +50 reputation, "Efficiency" badge
```

### Leaderboards

**Global Rankings:**
1. Fastest Vesting (days to graduation)
2. Most Productive (blocks produced)
3. Highest Uptime (% availability)
4. Most Fees Burned (total fees)
5. Best Reputation (community score)

**Founding Symbiont Ranks:**
```
Rank #1-10:     "Moss Founders" - Critical mass creators
Rank #11-100:   "Founding Symbionts" - Genesis validators
Rank #101-1000: "Early Adopters" - Network stabilizers
Rank #1001+:    "Moss Builders" - Community validators
```

### Progress Tracking

**Validator Dashboard:**
```
╔══════════════════════════════════════════════════════╗
║  🦞 Self-Made Symbiont Progress                         ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  Bootstrap Debt Repayment:                           ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░ 57.62% (5,762.18 / 10,000)   ║
║                                                      ║
║  Status:            Bootstrapping                    ║
║  Days Active:       25 days                          ║
║  Days to Graduate:  ~18 days ⚡                      ║
║                                                      ║
║  ┌────────────────────────────────────────────────┐ ║
║  │ Earnings Split (Last 24 Hours)                 │ ║
║  │                                                 │ ║
║  │ Total Earned:     864 LICN                   │ ║
║  │   → Liquid:       432 LICN 💰 (spendable)     │ ║
║  │   → Debt:         432 LICN 🔒 (locked)        │ ║
║  └────────────────────────────────────────────────┘ ║
║                                                      ║
║  Blocks Produced:   15,847                           ║
║  Uptime:            99.7% ✅                         ║
║  Reputation:        847 (Veteran)                    ║
║                                                      ║
║  ┌────────────────────────────────────────────────┐ ║
║  │ Achievements                                    │ ║
║  │ ✅ Moss Builder (1,000+ blocks)                │ ║
║  │ ⏳ Speed Vester (25/30 days)                   │ ║
║  │ ⏳ Diamond Spores (99.7% uptime)                │ ║
║  └────────────────────────────────────────────────┘ ║
║                                                      ║
║  Founding Rank:     #47 🏆                           ║
║  Community Power:   Top 5%                           ║
╚══════════════════════════════════════════════════════╝
```

---

## Graduation NFT

When a validator fully vests, an NFT is automatically minted:

```json
{
  "name": "Self-Made Symbiont #47",
  "description": "Founding validator who earned their stake through contribution, not capital",
  "image": "ipfs://QmSelfMadeSymbiont47...",
  "minted": "2026-03-15T14:32:07Z",
  "attributes": {
    "validator_pubkey": "symbiont_hqR8k3V2pN7xL9kW...",
    "debt_repaid": "100,000 LICN",
    "time_to_vest": "86 days",
    "total_blocks": 18429,
    "uptime_percentage": 99.8,
    "founding_validator": true,
    "founding_rank": 47,
    "reputation_score": 847,
    "badges": [
      "Self-Made Symbiont",
      "Founding Validator",
      "Speed Vester",
      "Moss Builder"
    ],
    "fastest_vester": false,
    "diamond_spores": false,
    "graduation_date": "2026-03-15"
  },
  "rarity": "Founding",
  "collection": "Self-Made Symbionts",
  "total_supply": 1000
}
```

---

## Delegation & Liquid Staking (Post-Graduation)

Once fully vested, validators can accept delegations:

### Standard Delegation

```rust
// Community member delegates to a fully vested validator
fn delegate(
    delegator: Pubkey,
    validator: Pubkey,
    amount: u64
) -> Result<()> {
    // Requires validator to be FullyVested
    if !validator.is_fully_vested() {
        return Err("Validator still bootstrapping");
    }
    
    // Transfer LICN to delegation pool
    transfer(delegator, delegation_pool, amount)?;
    
    // Update stake info
    validator.delegated_amount += amount;
    
    // Record delegator info
    delegations.insert(delegator, DelegationInfo {
        validator,
        amount,
        rewards_earned: 0,
        delegated_at: current_slot,
    });
    
    Ok(())
}
```

**Reward Split (historical per-block example; live chain settles at epoch boundaries):**
```
Validator reward enters the vesting pipeline

Commission (10%): 0.01 LICN to validator
Delegators (90%): 0.09 LICN split proportionally

Example with 40k LICN delegated:
  Validator own stake: 100,000 LICN (20%)
  Delegated stake:     400,000 LICN (80%)
  Total voting power:  500,000 LICN
  
  Delegator with 1,000 LICN:
    Share: 1,000 / 50,000 = 2%
    Reward: proportional share of the validator's settled delegation reward
```

### Liquid Staking (MossStake)

```rust
// Stake LICN, receive stLICN (liquid receipt token)
fn liquid_stake(amount: u64) -> u64 {
    // Deposit LICN
    let licn_deposited = amount;
    
    // Calculate stLICN to mint
    let total_staked = moss_stake_pool.total_staked;
    let total_st_licn = moss_stake_pool.total_st_licn_supply;
    
    let st_licn_to_mint = if total_st_licn == 0 {
        licn_deposited // 1:1 initially
    } else {
        // Account for accumulated rewards
        (licn_deposited * total_st_licn) / total_staked
    };
    
    // Mint stLICN to user
    mint_st_licn(caller, st_licn_to_mint)?;
    
    // Update pool
    moss_stake_pool.total_staked += licn_deposited;
    moss_stake_pool.total_st_licn_supply += st_licn_to_mint;
    
    st_licn_to_mint
}
```

**stLICN Characteristics:**
- 1:1 initially with LICN
- Appreciates over time (auto-compounding rewards)
- Fully liquid (trade, use in DeFi)
- Unstaking period: 7 days (for security)
- Can be used as collateral in lending protocols

---

## FAQ

**Q: Can I edit the 100,000 LICN bootstrap requirement?**  
A: No. It's hardcoded and verified cryptographically. This ensures network security and fairness—everyone starts at the same level.

**Q: What happens if I go offline during vesting?**  
A: Your debt doesn't increase, but you stop earning rewards (and thus stop repaying debt). Your vesting timeline extends proportionally to downtime.

**Q: Can I stop validating and withdraw my liquid rewards?**  
A: Yes! 50% of earnings are liquid immediately. You can withdraw, spend, or transfer at any time. The other 50% is locked for debt repayment.

**Q: What if I'm slashed during vesting?**  
A: Slashing applies to your earned_amount first. If earned_amount < slashing_penalty, your bootstrap_debt increases (you owe more work). Severe slashing can reset your vesting progress.

**Q: Can I accelerate vesting by contributing compute or building programs?**  
A: Future enhancement! We're considering contribution bonuses for:
  - Deploying high-usage programs (+10% vesting speed)
  - Contributing compute to network (+5% vesting speed)
  - Bug bounties and governance participation (+bonus LICN)

**Q: What happens at mainnet launch?**  
A: All validators start at bootstrap_debt = 100,000 LICN. Fair playing field. First to vest = Founding Validator #1.

**Q: Can I run multiple validators?**  
A: Yes, but each must vest independently. Each requires its own hardware, keypair, and ~86-day vesting period.

---

## Implementation Status

### ✅ Completed (February 7, 2026)
- [x] Documentation (WHITEPAPER, VISION, this doc)
- [x] Economic model designed
- [x] Gamification system designed
- [x] Achievement system designed

### ⏳ In Progress
- [ ] Core implementation (StakeInfo updates)
- [ ] Reward split logic (50/50 debt/liquid)
- [ ] Graduation event handling
- [ ] Dashboard UI updates
- [ ] NFT minting on graduation

### 🎯 Next Steps
1. Update `core/src/consensus.rs` with new fields
2. Implement 50/50 reward split in `claim_rewards()`
3. Add graduation event logging
4. Create achievement tracking system
5. Build NFT minting contract
6. Update validator dashboard UI
7. Add leaderboard API endpoints

---

## The Philosophy

> "On Lichen, validators don't need wealth—they need will.
> 
> Will to contribute.  
> Will to build.  
> Will to prove themselves through work.
> 
> Every Self-Made Symbiont is a testament to meritocracy over plutocracy.  
> Every graduation NFT is proof that contribution > capital.
> 
> We're not building a blockchain for the wealthy.  
> We're building a blockchain for the worthy.
> 
> Earn your stake. Prove your value. Graduate.  
> Become a Self-Made Symbiont."

🦞⚡

---

**The network is active.**  
**The upgrade is complete.**  
**The future is lichen.**
