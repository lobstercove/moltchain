# MoltChain Economics Model
**Version 1.0 - February 2026**

## Overview
MoltChain's economic model is designed to be **affordable, sustainable, and anti-plutocratic**. Our fee structure balances accessibility for users with sustainability for validators and prevents spam while enabling high-throughput applications.

**Note on Token Pricing**: All USD values are **illustrative examples** assuming market-driven token prices. At launch, MOLT will have **no predetermined price** - market discovery will determine value based on utility, demand, and network effects.

## Token Economics

### MOLT Token
- **Symbol**: MOLT
- **Decimal Places**: 9 (1 MOLT = 1,000,000,000 shells)
- **Initial Supply**: 1,000,000,000 MOLT (1 billion)
- **Launch Price**: Market-determined (no listing, no pre-sale)
- **Market Cap Goal**: $10M-$100M (achieved organically over time)
- **Inflation**: None - deflationary via fee burning

### Fee Burn Mechanism
- **50% of all fees are burned** (deflationary pressure)
- **50% goes to validators** (sustainability)
- Burn mechanism applies to all transaction types

## Transaction Fees

### Current Implementation (v1.0)

**All transactions currently use the same base fee:**
```
Fee: 10,000 shells (0.00001 MOLT)
Solana Comparison: $0.00025 per TX
```

**MoltChain at Different Price Points:**
- **$0.01/MOLT**: 0.00001 MOLT = **$0.0000001** per TX (2,500x cheaper than Solana)
- **$0.10/MOLT**: 0.00001 MOLT = **$0.00001** per TX (250x cheaper than Solana)
- **$1.00/MOLT**: 0.00001 MOLT = **$0.00001** per TX (25x cheaper than Solana)
- **$10.00/MOLT**: 0.00001 MOLT = **$0.0001** per TX (2.5x cheaper than Solana)

**Key Insight**: MoltChain remains **cheaper than Solana** even if MOLT reaches $10, while maintaining anti-spam protection.

**Use Cases:**
- Simple transfers
- Token swaps  
- Voting transactions
- Account creation
- Contract interactions

### Planned Fee Differentiation (v2.0)

Operation-specific fees are **IMPLEMENTED IN CODE** at competitive rates:

#### Contract Deployment
```
Implemented Fee: 2,500,000,000 shells (2.5 MOLT)
Code Location: core/src/processor.rs::CONTRACT_DEPLOY_FEE
Solana Contract Deploy: ~$5
```

**Competitiveness at Different MOLT Prices:**
- At $0.01/MOLT: $0.025 per deploy (200x cheaper than Solana)
- At $0.10/MOLT: $0.25 per deploy (20x cheaper than Solana)
- At $1.00/MOLT: **$2.50 per deploy** (2x cheaper than Solana $5)
- At $2.00/MOLT: $5.00 per deploy (matches Solana)
- At $10.00/MOLT: $25.00 (5x more expensive - governance adjusts)

**Rationale:**
- Prevents contract spam
- Sustainable barrier for serious developers
- One-time cost, no ongoing fees per call
- 50% burned = permanent supply reduction

#### Contract Upgrade
```
Implemented Fee: 1,000,000,000 shells (1 MOLT)
Code Location: core/src/processor.rs::CONTRACT_UPGRADE_FEE
Proportion: 40% of deployment cost
```

**Competitiveness:**
- At $0.10/MOLT: $0.10 per upgrade
- At $1.00/MOLT: **$1.00 per upgrade**
- At $5.00/MOLT: $5.00 (matches Solana deploy cost)

**Rationale:**
- Cheaper than deployment (iterative development friendly)
- Discourages reckless upgrades
- Aligns with "ship fast, iterate" philosophy

#### Contract Execution (Compute Fees)
```
Base Compute: Included in transaction fee
Additional Compute: 1 shell per 1,000 compute units
```

**Gas Pricing:**
- Storage Write: 5,000 compute units
- Storage Read: 200 compute units
- Function Call: 700 compute units
- Math Operation: 10 compute units

**Example Costs (at current BASE_FEE):**
- Simple contract call: 0.00001 MOLT
- Complex DeFi swap: 0.00002 MOLT (base + compute)
- Large state update: 0.00005 MOLT (base + heavy compute)

## NFT Economics

### NFT Minting (Implemented)
```
Standard Mint: 1,000,000 shells (0.001 MOLT)
Code Location: core/src/processor.rs::NFT_MINT_FEE

Bulk Collection: 100,000,000,000 shells (100 MOLT)
Code Location: core/src/processor.rs::NFT_COLLECTION_FEE
```

**Standard Mint Competitiveness:**
- At $0.10/MOLT: $0.0001 per mint (100x cheaper than Solana)
- At $1.00/MOLT: **$0.001 per mint** (10x cheaper than Solana)
- At $10.00/MOLT: $0.01 per mint (matches Solana)

**Collection Fee (Unlimited Mints):**
- At $0.10/MOLT: $10 per collection
- At $1.00/MOLT: $100 per collection
- At $10.00/MOLT: $1,000 per collection

**Break-even Analysis:**
- $1/MOLT scenario: 100 mints to break even ($100 collection vs $1/mint Solana)
- Makes sense for serious NFT projects with 1000+ items

### NFT Marketplace Fees
```
Platform Fee: 2.5% of sale price
Royalty Fee: 0-10% (set by creator)
Total Max Fee: 12.5%
```

**Fee Distribution:**
- 1.25% burned (deflationary)
- 1.25% to platform/marketplace
- Creator royalties paid directly

### NFT Storage
```
Base Metadata: Free (small JSON)
Extended Storage: 1 MOLT per 100KB per year
IPFS Pinning: 0.1 MOLT per pin (one-time)
```

## Oracle & Data Feed Economics

### Oracle Data Feed Submission
```
Price Feed Update: 100,000 shells (0.0001 MOLT)
Update Frequency: Every 60 seconds (max)
```

### Oracle Data Consumption
```
Query Fee: 10,000,000 shells (0.01 MOLT)
Subscription Model: 100 MOLT for 10,000 queries
```

**Rationale:**
- Sustainable for oracle operators
- Prevents spam queries
- Incentivizes data provider network

## Staking & Validator Economics

### Two-Phase Staking System

MoltChain implements **two distinct staking mechanisms** to support both validators and community members:

#### Phase 1: Validator Bootstrap Grants (ACTIVE)

**Purpose**: Zero-capital validator onboarding

```
Initial Capital Required: 0 MOLT (zero barrier to entry)
Bootstrap Grant: 10,000 MOLT (automatic on validator startup)
Bootstrap Mechanism: Debt-based vesting
Vesting Timeline: ~43 days of active validation (earning 0.18 MOLT/block avg)
Graduation: When bootstrap_debt reaches 0 (fully repaid through rewards)
```

**How It Works:**
1. Validator starts with 0 MOLT
2. System grants 10,000 MOLT on first block
3. Each block reward reduces bootstrap_debt
4. Validator graduates when debt = 0
5. Post-graduation: validator owns 100% of stake

**Economic Rationale:**
- Maximizes decentralization (no capital barrier)
- Validators "earn" their stake through work
- Aligns incentives (must perform to vest)
- Prevents Sybil (time-locked vesting)

#### Phase 2: Liquid Staking & Delegation (PLANNED - Q2 2026)

**Purpose**: Community participation in consensus rewards

**ReefStake Protocol:**
```
Stake MOLT → Receive stMOLT (1:1 ratio initially)
stMOLT = Liquid staking receipt token (tradeable, usable in DeFi)
Unstaking Period: 7 days (unbonding cooldown)
Auto-Compounding: Rewards automatically increase stMOLT:MOLT exchange rate
```

**Delegation Mechanics:**
```
Anyone can stake: Agents, humans, contracts
Delegate to validators: Choose validator by APY/reputation
Validator Commission: 5-10% (validator-configurable, 10% max)
Delegator Share: 90-95% of block rewards
Minimum Delegation: 1 MOLT (low barrier)
Redelegate: Switch validators anytime (no cooldown)
```

**Example Delegation:**
```
Validator "Alice":
  Own stake: 10,000 MOLT (from bootstrap)
  Delegated stake: 40,000 MOLT (from community)
  Total stake: 50,000 MOLT
  Commission: 10%

Block reward: 0.18 MOLT
  Alice keeps: 0.018 MOLT (10%)
  Delegators: 0.162 MOLT (90%, split proportionally)
    - Bob (20K): 0.081 MOLT (50% of delegation)
    - Carol (10K): 0.0405 MOLT (25%)
    - Dave (10K): 0.0405 MOLT (25%)
```

**APY Calculation:**
```
Formula:
  APY = (Annual Rewards / Your Stake) × 100%
  
  Annual Rewards = (Blocks/Year × Avg Reward × Delegator Share) × (Your Stake / Total Staked)
  
Example (10,000 MOLT staked, 100M MOLT total staked):
  Blocks/year: 78,840,000 (400ms blocks)
  Avg block reward: 0.1 MOLT (mix of TX and heartbeat)
  Delegator share: 90%
  
  Annual rewards: 78.84M × 0.1 × 0.9 × (10K / 100M)
                = 7.09M × 0.9 × 0.0001
                = 638 MOLT
  
  APY: (638 / 10,000) × 100% = 6.38%
```

**Target APY Range:**
- Early phase (low staking ratio): 10-25% APY
- Mature phase (30-50% staked): 5-15% APY
- Market-driven equilibrium (supply/demand)

**stMOLT Benefits:**
- Trade while staking (full liquidity)
- Use as DeFi collateral
- No lockup for trading (only 7 days for unstaking to MOLT)
- Auto-compounding (no manual claiming)

### Block Rewards
```
Transaction Block: 0.01 MOLT per block
Heartbeat Block: 0.001 MOLT per block
Annual Validator Earnings: ~1,000 MOLT (base)
USD Value: Market-determined
```

**Sustainability Model:**
- Block rewards provide base income
- 50% of transaction fees supplement rewards
- Deflationary fee burn increases scarcity over time
- No inflation beyond initial supply

### Delegation Fees
```
Validator Commission: 5-10% (set by validator)
Network Maximum: 10%
Minimum Delegation: 1 MOLT
Redelegate Cost: Free (no cooldown)
Unstake Cooldown: 7 days (unbonding period)
```

## Governance Economics

### Proposal Submission
```
Proposal Fee: 100 MOLT
Refund on Execution: 100% if passed
```

**Rationale:**
- Prevents spam proposals
- Shows commitment
- No cost if community supports

### Voting
```
Voting Fee: Free (gas included in transaction)
Vote Weight: 1 MOLT = 1 vote
Quadratic Voting: Not implemented (ensures simplicity)
```

## DeFi & Protocol Fees

### AMM Swap Fees
```
Swap Fee: 0.3% of trade value
Distribution: 0.25% to LPs, 0.05% burned
Minimum Fee: 0.001 MOLT
```

### Liquidity Provision
```
Pool Creation: 10 MOLT
LP Token Mint: Free
Staking Rewards: Pool-specific (from fees)
```

### Lending Protocol
```
Borrow Interest: 5-15% APR (market-driven)
Platform Fee: 10% of interest
Liquidation Fee: 5% of collateral
```

## Bridge & Cross-Chain Fees

### Asset Bridging
```
Bridge In: 0.1 MOLT
Bridge Out: 0.1 MOLT
Large Transfer (>10k USD): 0.5 MOLT
```

**Security:**
- Higher fees = more security budget
- Multi-sig validation required
- 24-hour delay on large transfers

## Storage Rent Economics

### Account Rent
```
Base Account: Rent-free
Smart Contract: 1 MOLT per 100KB per year
Large Data: 10 MOLT per 1MB per year
```

**Rent Exemption:**
- Validators: Rent-free
- System accounts: Rent-free
- Active accounts (>1 tx/month): Reduced 90%

## Annual Cost Projections

### For Users (Typical Activity)

**Current Implementation (BASE_FEE = 0.00001 MOLT):**
```
1,200 transactions/year: 0.012 MOLT
(100 tx/month at 0.00001 MOLT each)

Price Scenarios:
- At $0.10/MOLT: 0.012 MOLT = $0.0012/year
- At $1.00/MOLT: 0.012 MOLT = $0.012/year  
- At $10.00/MOLT: 0.012 MOLT = $0.12/year

Compare to Solana: 1,200 tx × $0.00025 = $0.30/year
MoltChain is cheaper at any realistic MOLT price!
```

**With Planned Differentiated Fees:**
```
1,200 transactions: 0.012 MOLT
10 contract deploys: 10 MOLT  
50 contract upgrades: 10 MOLT
12 NFT mints: 0.012 MOLT

Heavy Developer Annual: ~20 MOLT
At $1/MOLT: $20/year (incredibly cheap)
```

### For Validators
```
Hardware (VPS): $20/month = $240/year
Electricity (home): ~$3/month = $36/year
Or Own Hardware: $0/year (Mac Mini, PC, etc.)

Annual Revenue: ~1,000 MOLT (from blocks + fees)
USD Value: Market-determined

Break-even: Day 43 (when bootstrap vesting completes)
ROI: Infinite (no upfront capital required)
```

### For Developers
```
Contract Deployment: 10 MOLT (one-time)
10 Upgrades/year: 20 MOLT
Oracle Subscription: 100 MOLT/year
NFT Collection: 1,000 MOLT (one-time)

Annual Run Cost: ~120 MOLT + initial deployment
USD Cost: Market-determined, but always competitive
```

## Fee Adjustment Mechanism

### Overview
As MOLT price increases over time due to market demand, fees must be adjusted downward to maintain competitive USD-equivalent costs. MoltChain provides multiple mechanisms for fee adjustment to ensure the network remains affordable at any price point.

### Governance-Based Fee Adjustment (Primary Mechanism)

**Implementation Status**: Planned for DAO Phase
**Timeline**: Q2 2026

**Process:**
1. **Proposal Submission**: Any validator with >1% stake can propose fee changes
2. **Proposal Format**:
   ```rust
   pub struct FeeAdjustmentProposal {
       pub new_base_fee: Option<u64>,              // If None, no change
       pub new_contract_deploy_fee: Option<u64>,
       pub new_contract_upgrade_fee: Option<u64>,
       pub new_nft_mint_fee: Option<u64>,
       pub new_nft_collection_fee: Option<u64>,
       pub rationale: String,                      // Required explanation
       pub implementation_slot: u64,               // When to activate
   }
   ```

3. **Voting Period**: 7 days minimum
4. **Approval Threshold**: 66% supermajority of active validators (by stake weight)
5. **Implementation Delay**: 7 days after approval (allows ecosystem to prepare)
6. **Execution**: Automatic on-chain activation at specified slot

**Example Scenario:**
- MOLT price rises from $0.10 to $1.00 (10x increase)
- Current contract deploy: 2.5 MOLT = $2.50 → becomes $25 (too expensive!)
- Proposal: Reduce to 0.25 MOLT (new price: $0.25 - even cheaper than before)
- Vote passes → 7 days later, new fee activates automatically

### Dynamic Fee Multiplier (Congestion-Based)

**Implementation Status**: Active
**Applies to**: All transaction types

**Algorithm:**
```rust
// Current congestion-based multiplier (temporary adjustment)
match network_congestion {
    0..20%   => base_fee * 0.5,  // Low usage discount
    20..80%  => base_fee * 1.0,  // Normal operations
    80..95%  => base_fee * 1.5,  // High congestion
    95..100% => base_fee * 2.0,  // Extreme congestion
}
```

**Note**: Multipliers are temporary (per block) to manage spam during high load. They **do not** replace governance-based permanent adjustments for price changes.

### Price Oracle Integration (Future)

**Implementation Status**: Planned for v2.0
**Timeline**: Q3 2026

**Concept**: Automatic fee adjustment based on MOLT/USD price
```rust
pub struct PriceOracleConfig {
    pub target_usd_base_fee: f64,        // e.g., 0.00001 USD
    pub target_usd_contract_deploy: f64, // e.g., 2.50 USD
    pub adjustment_frequency: u64,       // e.g., every 1M slots (~4.6 days)
    pub max_adjustment_per_period: f64,  // e.g., 20% max change
}
```

**Benefits**:
- Maintains consistent USD costs automatically
- Reduces governance overhead
- Smoother adjustment curve

**Safeguards**:
- Maximum adjustment per period (prevents oracle manipulation)
- Circuit breaker for extreme price swings
- Governance can override oracle decisions

### Emergency Fee Adjustment

**Implementation Status**: Active (via validator coordination)
**Use Case**: Critical spam attack or extreme price volatility

**Process:**
1. **Trigger**: Network under attack or fees become prohibitively expensive
2. **Coordination**: Core validator team proposes emergency adjustment
3. **Deployment**: Most validators upgrade to new fee constants
4. **Consensus**: New fees activate when 66% of stake upgrades
5. **Ratification**: Post-emergency DAO vote to confirm changes

**Example Emergency:**
- MOLT price suddenly jumps to $100 (100x overnight)
- Contract deploy: 2.5 MOLT = $250 (blocks ecosystem development)
- Emergency adjustment: 0.025 MOLT = $2.50 (restores affordability)

### Current Fee Constants (Code Reference)

**Location**: `core/src/processor.rs`
```rust
pub const BASE_FEE: u64 = 10_000;                    // 0.00001 MOLT
pub const CONTRACT_DEPLOY_FEE: u64 = 2_500_000_000;  // 2.5 MOLT
pub const CONTRACT_UPGRADE_FEE: u64 = 1_000_000_000; // 1 MOLT
pub const NFT_MINT_FEE: u64 = 1_000_000;             // 0.001 MOLT
pub const NFT_COLLECTION_FEE: u64 = 100_000_000_000; // 100 MOLT
```

**To Adjust Fees Manually** (pre-DAO):
1. Update constants in `core/src/processor.rs`
2. Build new validator binary: `cargo build --release`
3. Coordinate upgrade with validator community
4. Deploy simultaneously to avoid consensus issues

### Fee Adjustment History (Planned Tracking)

**Format**: On-chain record of all fee changes
```rust
pub struct FeeAdjustmentRecord {
    pub slot: u64,
    pub old_fees: FeeSchedule,
    pub new_fees: FeeSchedule,
    pub molt_price_at_adjustment: Option<f64>,  // If oracle available
    pub proposal_id: Option<String>,            // Governance proposal
    pub reason: String,
}
```

**Benefits**:
- Transparency for ecosystem participants
- Historica data for economic analysis
- Predictability for developers

### Best Practices for Fee Adjustments

**When to Adjust:**
- MOLT price sustained above $1 for >30 days
- Contract deploy fees >$5 USD equivalent
- Base TX fees >$0.0001 USD equivalent
- Community feedback indicates pain points

**When NOT to Adjust:**
- Short-term price volatility (<7 days)
- Price changes <50%
- During governance votes (avoid confusion)

**Target USD Equivalents** (maintain competitiveness):
- Base TX: $0.00001 - $0.0001
- Contract Deploy: $0.50 - $5.00
- Contract Upgrade: $0.25 - $2.00
- NFT Mint: $0.0001 - $0.01

### Dynamic Fee Algorithm
```
Base Fee Multiplier: 1.0x (starting point)
High Congestion (>80% capacity): 1.5x multiplier
Extreme Congestion (>95%): 2.0x multiplier
Low Usage (<20%): 0.5x multiplier
```

**Implementation Status**: Active (see "Dynamic Fee Multiplier" section above)

## Economic Security

### Spam Prevention
- All transactions cost minimum 0.00001 MOLT (10,000 shells)
- Rate limiting: 1000 tx/second per account
- Contract deployment barrier: 1 MOLT (planned)
- Fee burning reduces circulating supply

### Validator Incentives
- No upfront capital = maximum accessibility
- Work-based stake = meritocratic
- Block rewards sustain operations
- Slashing for misbehavior

### Long-term Sustainability
```
Daily Transaction Volume: 10M (conservative)
Daily Fee Revenue: 10,000 MOLT
Daily Burn: 5,000 MOLT
Daily Validator Rewards: 5,000 MOLT

Annual Deflation: ~1.8M MOLT (0.18% of supply)
```

## Comparison Matrix

**MoltChain Current Implementation vs Competition**

| Operation | MoltChain Fee | At $1/MOLT | Solana | Ethereum | MoltChain Advantage |
|-----------|---------------|------------|--------|----------|---------------------|
| Simple TX | 0.00001 MOLT | $0.00001 | $0.00025 | $2.00 | 25x cheaper than Solana |
| Simple TX | 0.00001 MOLT | At $10/MOLT = $0.0001 | $0.00025 | $2.00 | 2.5x cheaper even at $10 |
| 1,000 TXs | 0.01 MOLT | $0.01 | $0.25 | $2,000 | 25x cheaper than Solana |
| Annual (1,200 TX) | 0.012 MOLT | $0.012 | $0.30 | $2,400 | 25x cheaper than Solana |

**Planned Differentiated Fees vs Competition**

| Operation | Implemented Fee | At $0.10/MOLT | At $1/MOLT | Solana | Advantage |
|-----------|-----------------|---------------|------------|--------|-----------|  
| Simple TX | 0.00001 MOLT | $0.000001 | $0.00001 | $0.00025 | 25x cheaper |
| Contract Deploy | 2.5 MOLT | $0.25 | **$2.50** | $5.00 | 2x cheaper |
| Contract Upgrade | 1 MOLT | $0.10 | **$1.00** | $5.00 | 5x cheaper |
| NFT Mint | 0.001 MOLT | $0.0001 | **$0.001** | $0.01 | 10x cheaper |
| NFT Collection | 100 MOLT | $10 | $100 | $500 | 5x cheaper |

**Key Insight**: All fees are defined in MOLT/shells, prices scale with market value, but always remain competitive with Solana up to $2/MOLT.

**Validator Economics Comparison**

| Cost Type | MoltChain | Solana | Ethereum |
|-----------|-----------|--------|----------|
| Hardware | $0-240/yr | $1,000/yr | $5,000/yr |
| Initial Stake | $0 | $50,000 | $100,000 |
| Barrier | Work | Capital | Massive Capital |

**Key Insight**: MoltChain maintains competitive pricing even if MOLT reaches $10, while Solana fees are fixed in USD. At $1 MOLT, MoltChain is 25x cheaper for transactions and 5x cheaper for contract operations.

## Economic Sustainability

### Token Price Discovery

MOLT will find its natural market price through:

1. **Organic Adoption**: Network usage creates utility-driven demand
2. **Fee Burn Dynamics**: 50% of fees burned = decreasing supply
3. **Validator Economics**: Sustainable block rewards attract operators
4. **Market Consensus**: No pre-sale, no listing fees, pure price discovery
5. **Network Effects**: More users → more fees → more burn → more scarcity

### Realistic Price Scenarios

**Conservative Launch ($MOLT = $0.01)**:
- Market Cap: $10 million
- Transaction: 0.00001 MOLT = **$0.0000001** per TX
- Contract Deploy (planned): 1 MOLT = $0.01
- Validator Revenue: ~1,000 MOLT/yr = $10/year
- **vs Solana**: 2,500x cheaper TXs, unlimited cheaper deploys

**Realistic Launch Scenario ($MOLT = $0.10)**:
- Market Cap: $100 million (achievable)
- Transaction: 0.00001 MOLT = **$0.000001** per TX
- Contract Deploy: 2.5 MOLT = **$0.25**
- Contract Upgrade: 1 MOLT = **$0.10**
- NFT Mint: 0.001 MOLT = **$0.0001**
- Validator Revenue: ~1,000 MOLT/yr = $100/year
- **vs Solana**: 250x cheaper TXs, 20x cheaper deploys

**Target Growth Scenario ($MOLT = $1.00)**:
- Market Cap: $1 billion (success case)
- Transaction: 0.00001 MOLT = **$0.00001** per TX
- Contract Deploy: 2.5 MOLT = **$2.50**
- Contract Upgrade: 1 MOLT = **$1.00**
- NFT Mint: 0.001 MOLT = **$0.001**
- Validator Revenue: ~1,000 MOLT /yr = $1,000/year
- **vs Solana**: 25x cheaper TXs, 2x cheaper deploys

**Success Scenario ($MOLT = $10.00)**:
- Market Cap: $10 billion
- Transaction: 0.00001 MOLT = **$0.0001** per TX
- Contract Deploy (planned): 1 MOLT = $10.00
- Validator Revenue: ~1,000 MOLT/yr = $10,000/year
- **vs Solana**: 2.5x cheaper TXs, 2x more expensive deploys (governance would adjust fees)

**All scenarios maintain**:
- ✅ Competitive pricing vs alternatives
- ✅ Sustainable validator economics
- ✅ Anti-spam protection
- ✅ Deflationary dynamics

## Future Considerations

### Layer 2 Integration
- Rollups for 10x cheaper transactions
- Cross-chain bridges
- State channels

### Compute Pricing
- More granular gas model
- Efficient WebAssembly execution

### Storage Markets
- Decentralized storage with dynamic pricing
- Rent-free for active users

### MEV Mitigation
- Fee smoothing mechanisms
- Fair ordering

### Community Governance
- Quarterly fee review
- Annual economics audit
- On-chain voting for adjustments
- Transparency dashboard

---

**Last Updated**: February 7, 2026
**Next Review**: May 1, 2026
**Status**: Realistic pricing for community review
