# MoltChain Genesis & Trading Architecture

> Historical architecture note: this document preserves an early single-treasury model.
> The live chain now boots with the canonical 500M MOLT genesis distribution across dedicated treasury wallets,
> not a single 1B treasury account, and protocol inflation settles at epoch boundaries.

## Genesis Treasury Wallet

### What is the Genesis Account?

**Address**: `6YkFWKH9HQZFVEy4QPw82xRx5qHRk84vU1H2Hk7JLj1H`  
**Initial Balance**: historical single-treasury assumption  
**Purpose**: preserved for architecture history; not the live genesis layout

### How It Works

When the first validator starts MoltChain:

1. **Genesis State Created** ([validator/src/main.rs](../validator/src/main.rs#L137))
   ```rust
   // Historical sketch only: live chain uses canonical split genesis wallets,
   // not a single treasury account with the entire supply.
   ```

2. **No Early Access** - The genesis account is created programmatically from:
   - Default testnet config: [core/src/genesis.rs](../core/src/genesis.rs#L260)
   - Custom genesis.json (if provided via `--genesis` flag)

3. **Private Key** - Whoever has the private key for `6YkFWKH9HQZFVEy4QPw82xRx5qHRk84vU1H2Hk7JLj1H` controls the treasury
   - **Testnet**: Key is known (for testing)
   - **Mainnet**: Key should be multi-sig controlled by foundation/DAO

### Do We Have Access?

**Testnet**: YES - The genesis private key is derived from a known seed for testing purposes.

**Mainnet**: Should be multi-signature wallet controlled by:
- Core team (3/5 signatures)
- Community governance (after Year 1)
- Eventually: Full DAO control with on-chain voting

### What Happens to the Genesis Allocation?

The rest of this document describes the original single-treasury distribution concept and should be read as historical design context rather than the live genesis implementation.

The genesis treasury is gradually distributed via:

#### 1. Validator Bootstrap Grants (250M MOLT allocation)
```rust
// Validators automatically receive 100K MOLT on startup
// Code: validator/src/main.rs lines 242-254
if validator_account.is_none() {
    let bootstrap_account = Account::new(100_000, validator_pubkey);
    state.put_account(&validator_pubkey, &bootstrap_account).unwrap();
}
```

**How bootstrap works:**
- **100,000 MOLT** given to each new validator
- Recorded as `bootstrap_debt` ( validator "owes" this to the protocol)
- Debt reduces as validator earns block rewards
- Takes ~86 days to fully vest (graduation)
- After graduation: validator owns 100% of stake

**Distribution timeline:**
- Max validators: 25,000 (reasonable for Year 1)
- Max bootstrap grants: 25,000 × 10K = 250M MOLT (25% of supply)
- Actual: Organic - as validators join
- Treasury reduction: 1B → 750M remaining after all validators bootstrap

#### 2. Builder Grants (250M MOLT allocation)
```markdown
From VISION.md & WHITEPAPER.md:
- Smart contract developers: 100M MOLT
- DeFi protocol teams: 75M MOLT  
- Community projects: 50M MOLT
- Research & education: 25M MOLT
```

**Distribution mechanism** (not yet implemented):
- On-chain proposal system
- Builders submit grant requests
- Validators vote (66% approval)
- Grants vest over 6-12 months

**Treasury impact**: 750M → 500M remaining after builder grants

#### 3. Liquidity Provision (200M MOLT allocation)
```markdown
Purpose: Bootstrap DEX liquidity for MOLT trading

Initial pairs:
- MOLT/USDC: 50M MOLT
- MOLT/ETH: 50M MOLT  
- MOLT/SOL: 50M MOLT
- MOLT/BTC: 50M MOLT
```

**LP strategy**:
- Protocol-owned liquidity (POL)
- Deployed to ClawSwap (native DEX)
- Earns trading fees → Treasury revenue
- Never removed (permanent liquidity)

**Treasury impact**: 500M → 300M remaining after LP

#### 4. Strategic Reserve (300M MOLT - kept in treasury)
```markdown
Uses:
- Market making during volatile periods
- Emergency validator subsidies
- Unexpected protocol expenses
- Future initiatives not yet planned
```

### Trading: How Does $MOLT Get Liquidity?

**Phase 1: Internal Trading (NOW - Faucet only)**
```
Status: ✅ LIVE
- Faucet gives 100 MOLT for testing
- Users can transfer between accounts
- No $ price yet (testnet)
```

**Phase 2: DEXEnablement (Month 2-3)**
```
Status: 📋 PLANNED
- ClawSwap DEX launches (native on MoltChain)
- AMM pools: MOLT/USDC, MOLT/ETH, etc.
- Genesis treasury provides initial liquidity
- $MOLT price discovery begins
```

**Phase 3: Bridge to Ethereum (Month 4-6)**
```
Status: 🔮 FUTURE
- Wrapped MOLT (wMOLT) on Ethereum
- List on Uniswap, Curve, Balancer
- Cross-chain liquidity
- CEX listings (if demand exists)
```

**Phase 4: Agent Trading (Month 6+)**
```
Status: 🔮 FUTURE
- AI agents trade MOLT autonomously
- Agent-to-agent MOLT transfers
- Programmatic market making
- Arbitrage bots stabilize price
```

### Token Distribution Timeline

**Year 1 (2026, historical model):**
```
Genesis allocation:      500,000,000 MOLT (100%)
   - Validator rewards:     -50,000,000 MOLT (10%)
   - Community treasury:   -125,000,000 MOLT (25%)
   - Builder grants:       -175,000,000 MOLT (35%)
   - Founding moltys:       -50,000,000 MOLT (10%)
   - Ecosystem partners:    -50,000,000 MOLT (10%)
   - Reserve pool:          -50,000,000 MOLT (10%)
```

**Year 2 (2027):**
```
Circulating increases as:
- More validators graduate (unlock bootstrap grants)
- Builder grants vest
- Some strategic reserve deployed
  
Expected circulating: 400-425M MOLT (80-85% of genesis supply, before net mint/burn effects)
```

**Year 3+ (2028+):**
```
Full decentralization:
- DAO controls remaining treasury
- No central foundation control
- Community votes on spending
- Deflationary pressure (40% fees burned)
  
Expected circulating: 450-475M MOLT (90-95% of genesis supply, before net mint/burn effects)
Remaining treasury: 25-50M MOLT (5-10% of genesis supply emergency reserve)
```

### Deflationary Mechanics

**Fee Burning** ([core/src/consensus.rs](../core/src/consensus.rs)):
```rust
// 40% of all transaction fees are BURNED (permanently removed)
let burn_amount = fee_amount * 40 / 100;
// Burned MOLT is gone forever - reduces total supply
```

**Impact on Supply (historical fixed-supply example):**
```
Year 1: 500,000,000 MOLT genesis baseline
  - Network activity: 10M transactions
  - Avg fee: 0.0001 MOLT
  - Total fees: 1,000 MOLT
  - Burned: 500 MOLT
  
Year 1 end: 499,999,500 MOLT before any net protocol minting

Year 5: Heavy DeFi activity
  - 1B transactions
  - Total fees: 100,000 MOLT
  - Burned: 50,000 MOLT
  
Year 5 end: ~999,900,000 MOLT total supply

Year 10: Mature ecosystem
  - 100B transactions
  - Total fees: 10,000,000 MOLT
  - Burned: 5,000,000 MOLT
  
Year 10 end: ~995,000,000 MOLT total supply
```

**Long-term projection**: Circulating supply gradually decreases due to burn, making MOLT more scarce.

### Trading Price Discovery

**How $MOLT Gets a Market Price:**

1. **Initial Liquidity (Month 2)**
   ```
   Treasury deploys: 50M MOLT + 50M USDC to ClawSwap
   Initial rate: $1.00 per MOLT (set by treasury)
   ```

2. **Market Trading (Month 2+)**
   ```
   Buyers/sellers determine real price via AMM
   If demand > supply → price ↑
   If supply > demand → price ↓
   ```

3. **External Validation (Month 4+)**
   ```
   Bridge to Ethereum → Uniswap listing
   CEX arbitrage → price consistency
   Multiple trading venues → efficient price discovery
   ```

4. **Long-term Value Drivers**
   ```
   Factors that support $MOLT price:
   - Transaction demand (need MOLT for fees)
   - Staking demand (earn rewards)
   - DeFi collateral (use MOLT in lending)
   - Deflationary burn (reduces supply)
   - Agent adoption (AI agents need MOLT)
   ```

### Who Can Trade MOLT?

**Now (Testnet):**
- Anyone via faucet (free 100 MOLT)
- Transfers between accounts
- No real $ value (test tokens)

**Month 2 (DEX Launch):**
- Anyone with MoltChain wallet
- Trade on ClawSwap (native DEX)
- Add liquidity (earn fees)
- Real $ price discovery

**Month 4+ (Bridges):**
- Trade on Uniswap (Ethereum)
- Trade on CEXs (if listed)
- Cross-chain swaps
- Global liquidity

### Genesis Treasury Management

**Current Control** (Testnet):
- Core team has private key
- Manual transfers for grants
- No formal governance

**Roadmap** (Mainnet):
```
Month 1-6: Multi-sig (3/5 core team)
Month 6-12: Hybrid (2 core + 3 elected community)
Year 2+: Full DAO (on-chain voting)
```

**Transparency**:
- Genesis account: `6YkFWKH9HQZFVEy4QPw82xRx5qHRk84vU1H2Hk7JLj1H`
- Publicly auditable on explorer
- All spending visible on-chain
- Community can track treasury movements

### Key Takeaways

1. **Genesis starts from 500M MOLT** with the initial distribution tracked transparently on-chain
2. **No pre-mine for founders** - fair distribution via work (validators) and grants (builders)
3. **Gradual unlock** - 3-5 years to fully distribute supply
4. **Deflationary** - 40% of fees burned permanently
5. **Transparent** - All treasury movements visible on-chain
6. **Trading starts** - Month 2-3 with DEX launch
7. **Price discovery** - Market-driven via AMM (no fixed price)
8. **Anyone can trade** - No KYC, no restrictions (after DEX launch)

---

## Implementation Checklist

**Genesis & Distribution:**
- [x] Genesis account creation
- [x] Validator bootstrap grants (100K MOLT each)
- [ ] Builder grant proposal system
- [ ] DAO governance for treasury spending
- [ ] Multi-sig wallet for genesis key

**Trading Infrastructure:**
- [ ] ClawSwap DEX implementation
- [ ] AMM pools (MOLT/USDC, etc.)
- [ ] Initial liquidity deployment (200M MOLT)
- [ ] Price oracle integration
- [ ] Bridge to Ethereum (wMOLT)
- [ ] CEX integration toolkit

**Transparency:**
- [x] Explorer shows all accounts
- [x] Genesis account balance visible
- [ ] Treasury dashboard (spending tracker)
- [ ] Grant distribution history
- [ ] Burn statistics (total MOLT burned)

---

**Last Updated**: February 8, 2026  
**Status**: Genesis treasury operational, trading infrastructure in development
