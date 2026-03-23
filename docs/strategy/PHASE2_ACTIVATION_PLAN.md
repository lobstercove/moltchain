# Phase 2 Staking Activation Plan

## Current Status (February 8, 2026)

**Phase 1** ✅ ACTIVE:
- Validator bootstrap grants (100K LICN)
- Vesting system working
- 3 validators currently operational

**Phase 2** 📦 CODE EXISTS, NOT WIRED:
- [core/src/mossstake.rs](../core/src/mossstake.rs) - Full protocol implemented
- No RPC endpoints yet
- No wallet UI integration
- Delegation mechanics ready but unused

---

## Activation Checklist

### 1. Core Integration (Backend)

#### A. Add MossStake to Validator State
**File**: `validator/src/main.rs`

```rust
use lichen_core::MossStakePool;

// Add after stake_pool initialization
let moss_stake = Arc::new(Mutex::new(MossStakePool::new()));

// Clone for handlers
let moss_stake_for_rpc = moss_stake.clone();
let moss_stake_for_blocks = moss_stake.clone();
```

#### B. Integrate with Block Processing
**File**: `validator/src/main.rs` (block production loop)

```rust
// After distributing validator rewards, distribute staking rewards
let mut moss = moss_stake_for_blocks.lock().await;
moss.distribute_rewards(block_reward * 0.9, current_slot); // 90% to stakers
```

### 2. RPC Endpoints (API Layer)

#### A. Add Staking Methods to RPC
**File**: `rpc/src/lib.rs`

```rust
// New RPC methods to add:

/// Stake LICN, receive stLICN
"stakeToMossStake" => handle_stake_to_moss_stake(&state, params).await,

/// Request unstake (7-day cooldown)
"unstakeFromMossStake" => handle_unstake_from_moss_stake(&state, params).await,

/// Claim unstaked tokens after cooldown
"claimUnstakedTokens" => handle_claim_unstaked(&state, params).await,

/// Get staking position for user
"getStakingPosition" => handle_get_staking_position(&state, params).await,

/// Get MossStake pool stats (total staked, APY, etc.)
"getMossStakePoolInfo" => handle_get_pool_info(&state, params).await,

/// Get unstaking queue for user
"getUnstakingQueue" => handle_get_unstaking_queue(&state, params).await,
```

#### B. Implementation Skeleton

```rust
/// Stake LICN → stLICN
async fn handle_stake_to_moss_stake(
    state: &RpcState,
    params: Option<serde_json::Value>,
) -> Result<serde_json::Value, RpcError> {
    // 1. Parse params: (from_pubkey, amount_licn)
    // 2. Get MossStake pool from state
    // 3. Call moss_stake.stake(user, amount, current_slot)
    // 4. Return stLICN minted
    
    Ok(serde_json::json!({
        "stLicnMinted": st_licn_amount,
        "exchangeRate": exchange_rate,
        "totalStaked": total_staked,
    }))
}

/// Request unstake (start 7-day cooldown)
async fn handle_unstake_from_moss_stake(
    state: &RpcState,
    params: Option<serde_json::Value>,
) -> Result<serde_json::Value, RpcError> {
    // 1. Parse params: (from_pubkey, st_licn_amount)
    // 2. Call moss_stake.request_unstake(user, amount, current_slot)
    // 3. Return unstake request info
    
    Ok(serde_json::json!({
        "requestId": request_id,
        "stLicnBurned": st_licn_amount,
        "licnToReceive": licn_amount,
        "claimableAt": claimable_slot,
        "claimableTime": estimated_time,
    }))
}

/// Get staking position
async fn handle_get_staking_position(
    state: &RpcState,
    params: Option<serde_json::Value>,
) -> Result<serde_json::Value, RpcError> {
    // 1. Parse params: (pubkey)
    // 2. Get position from moss_stake
    // 3. Return position details
    
    Ok(serde_json::json!({
        "stLicnBalance": position.st_licn_amount,
        "licnDeposited": position.licn_deposited,
        "currentValue": current_licn_value,
        "rewardsEarned": position.rewards_earned,
        "depositedAt": position.deposited_at,
        "apy": calculated_apy,
    }))
}

/// Get pool statistics
async fn handle_get_pool_info(
    state: &RpcState,
    _params: Option<serde_json::Value>,
) -> Result<serde_json::Value, RpcError> {
    // Get MossStake pool stats
    
    Ok(serde_json::json!({
        "totalStaked": pool.total_licn_staked,
        "totalStLicn": pool.total_supply,
        "exchangeRate": pool.exchange_rate,
        "averageApy": pool.average_apy,
        "totalStakers": pool.positions.len(),
        "totalValidators": pool.total_validators,
    }))
}
```

### 3. Wallet UI Integration (Frontend)

#### A. Update Staking Tab for Non-Validators
**File**: `wallet/js/wallet.js` (around line 648)

**BEFORE** (wrong - hides staking):
```javascript
if (!myValidator) {
    stakingTabBtn.style.display = 'none';  // ❌ WRONG
    return;
}
```

**AFTER** (correct - shows delegation UI):
```javascript
if (!myValidator) {
    // Show community staking interface
    loadCommunityStakingUI();
} else {
    // Show validator bootstrap UI
    loadValidatorStakingUI();
}

async function loadCommunityStakingUI() {
    // 1. Get pool info
    const poolInfo = await rpc.call('getMossStakePoolInfo');
    
    // 2. Get user's staking position
    const position = await rpc.call('getStakingPosition', [walletPubkey]);
    
    // 3. Render staking form
    stakingSection.innerHTML = `
        <div class="staking-overview">
            <h3>💎 Liquid Staking (MossStake)</h3>
            <div class="pool-stats">
                <div>Total Staked: ${poolInfo.totalStaked.toLocaleString()} LICN</div>
                <div>Average APY: ${poolInfo.averageApy.toFixed(2)}%</div>
                <div>Exchange Rate: 1 stLICN = ${poolInfo.exchangeRate.toFixed(4)} LICN</div>
            </div>
        </div>
        
        <div class="my-position">
            <h4>Your Position</h4>
            ${position ? `
                <div class="position-details">
                    <div>stLICN Balance: ${position.stLicnBalance}</div>
                    <div>Current Value: ${position.currentValue} LICN</div>
                    <div>Rewards Earned: ${position.rewardsEarned} LICN</div>
                    <div>APY: ${position.apy.toFixed(2)}%</div>
                </div>
            ` : `
                <p>No staking position yet</p>
            `}
        </div>
        
        <div class="stake-actions">
            <h4>Stake LICN</h4>
            <input type="number" id="stakeAmount" placeholder="Amount to stake">
            <button onclick="stakeToMossStake()">Stake → Get stLICN</button>
            
            <h4>Unstake stLICN (7-day cooldown)</h4>
            <input type="number" id="unstakeAmount" placeholder="stLICN to unstake">
            <button onclick="unstakeFromMossStake()">Unstake</button>
        </div>
        
        <div class="unstaking-queue">
            <h4>Unstaking Queue</h4>
            <div id="unstakeRequests"></div>
        </div>
    `;
    
    // Load unstaking queue
    loadUnstakingQueue();
}

async function stakeToMossStake() {
    const amount = document.getElementById('stakeAmount').value;
    if (!amount || amount <= 0) {
        alert('Enter valid amount');
        return;
    }
    
    try {
        // 1. Create stake transaction
        const tx = await createStakeTransaction(amount);
        
        // 2. Send to RPC
        const result = await rpc.call('stakeToMossStake', [walletPubkey, Number(amount)]);
        
        alert(`Staked ${amount} LICN! Received ${result.stLicnMinted} stLICN`);
        
        // 3. Refresh UI
        loadCommunityStakingUI();
    } catch (error) {
        alert('Staking failed: ' + error.message);
    }
}

async function unstakeFromMossStake() {
    const amount = document.getElementById('unstakeAmount').value;
    if (!amount || amount <= 0) {
        alert('Enter valid stLICN amount');
        return;
    }
    
    try {
        const result = await rpc.call('unstakeFromMossStake', [walletPubkey, Number(amount)]);
        
        alert(`Unstake requested! You can claim ${result.licnToReceive} LICN in 7 days`);
        
        // Refresh UI
        loadCommunityStakingUI();
    } catch (error) {
        alert('Unstaking failed: ' + error.message);
    }
}

async function loadUnstakingQueue() {
    const queue = await rpc.call('getUnstakingQueue', [walletPubkey]);
    const container = document.getElementById('unstakeRequests');
    
    if (!queue || queue.length === 0) {
        container.innerHTML = '<p>No pending unstakes</p>';
        return;
    }
    
    container.innerHTML = queue.map(req => `
        <div class="unstake-request">
            <div>Amount: ${req.licnToReceive} LICN</div>
            <div>Claimable: ${new Date(req.claimableTime).toLocaleString()}</div>
            ${req.canClaim ? 
                `<button onclick="claimUnstaked('${req.requestId}')">Claim Now</button>` :
                `<div>⏳ ${req.remainingTime}</div>`
            }
        </div>
    `).join('');
}

async function claimUnstaked(requestId) {
    try {
        await rpc.call('claimUnstakedTokens', [requestId]);
        alert('Claimed successfully!');
        loadCommunityStakingUI();
    } catch (error) {
        alert('Claim failed: ' + error.message);
    }
}
```

#### B. Update HTML Structure
**File**: `wallet/index.html` (Staking section)

```html
<div class="tab-content" id="stakingContent">
    <!-- Community Staking (Phase 2) -->
    <div id="communityStaking" style="display: none;">
        <!-- Loaded dynamically by JS -->
    </div>
    
    <!-- Validator Bootstrap (Phase 1) -->
    <div id="validatorStaking" style="display: none;">
        <!-- Existing validator UI -->
    </div>
</div>
```

### 4. Testing Plan

#### A. Unit Tests

```bash
# Test MossStake core
cd core && cargo test mossstake

# Specific tests:
- test_stake_mint_stlicn
- test_unstake_request
- test_exchange_rate_calculation
- test_reward_distribution
- test_claim_after_cooldown
```

#### B. Integration Tests

```bash
# Start testnet validator
./skills/validator/run-validator.sh

# Test RPC endpoints
curl -X POST http://localhost:8899 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getMossStakePoolInfo",
    "params": []
  }'

# Expected response:
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "totalStaked": 0,
    "totalStLicn": 0,
    "exchangeRate": 1.0,
    "averageApy": 0.0
  }
}
```

#### C. Wallet UI Tests

1. Open wallet: http://localhost:3000
2. Check staking tab visible (even if not validator)
3. View pool statistics
4. Stake 100 LICN
5. Check stLICN balance
6. Request unstake
7. Check unstaking queue
8. Wait 7 days (or simulate slot advance)
9. Claim unstaked tokens

### 5. Documentation Updates

#### A. User Guide
**File**: `docs/STAKING_USER_GUIDE.md` (new)

- How to stake LICN
- What is stLICN?
- Understanding APY
- Unstaking process (7 days)
- Using stLICN in DeFi

#### B. Developer Guide
**File**: `docs/STAKING_DEVELOPER_GUIDE.md` (new)

- MossStake protocol architecture
- RPC endpoint reference
- Integration examples
- Transaction formats

#### C. Update Main Docs
- [README.md](../README.md) - Add Phase 2 status
- [ECONOMICS.md](../ECONOMICS.md) - Already updated ✅
- [WHITEPAPER.md](../docs/WHITEPAPER.md) - Mark Phase 2 as ACTIVE

### 6. Deployment Steps

#### Step 1: Backend (Week 1)
```bash
# 1. Add MossStake integration to validator
# 2. Add RPC endpoints
# 3. Test locally
# 4. Deploy to testnet
```

#### Step 2: Frontend (Week 1-2)
```bash
# 1. Update wallet JS
# 2. Test staking UI
# 3. Test delegation flow
# 4. Deploy wallet updates
```

#### Step 3: Validation (Week 2)
```bash
# 1. Internal testing (core team)
# 2. External testers (community)
# 3. Bug fixes
# 4. Performance tuning
```

#### Step 4: Mainnet (Week 3)
```bash
# 1. Governance vote (if needed)
# 2. Coordinate validator upgrades
# 3. Activate MossStake
# 4. Monitor closely for 48 hours
```

### 7. Risk Mitigation

**Risks:**
1. **Exchange rate calculation bug** → Stakers lose value
   - Mitigation: Extensive unit tests, third-party audit
   
2. **Cooldown bypass** → Flash unstaking attack
   - Mitigation: Enforce slot checks in unstake claim
   
3. **Reward distribution error** → Wrong APY
   - Mitigation: Separate reward tracking, audit trail

4. **RPC DDoS** → Staking endpoints get spammed
   - Mitigation: Rate limiting, signature requirements

**Rollback Plan:**
```rust
// Emergency disable flag
pub struct MossStakePool {
    enabled: bool,  // Toggle via governance
    // ... rest of fields
}

// Check in all public methods
pub fn stake(&mut self, ...) -> Result<u64, String> {
    if !self.enabled {
        return Err("Staking temporarily disabled".to_string());
    }
    // ... rest of logic
}
```

### 8. Success Metrics

**Week 1:**
- [ ] 10+ test staking transactions
- [ ] 0 critical bugs found
- [ ] RPC response time < 100ms

**Week 2:**
- [ ] 50+ LICN staked by community
- [ ] 5+ active stakers
- [ ] APY calculation accurate

**Month 1:**
- [ ] 1,000+ LICN staked
- [ ] 25+ active stakers
- [ ] Unstaking queue working smoothly

**Month 3:**
- [ ] 10,000+ LICN staked
- [ ] 100+ active stakers
- [ ] Integration with first DeFi protocol

---

## Current Blockers

1. **No RPC endpoints** - Need to implement 6 new methods
2. **Wallet UI outdated** - Currently hides staking for non-validators
3. **No reward distribution** - Need to wire up block rewards to MossStake
4. **No testing** - Need comprehensive test suite

---

## Immediate Next Steps (This Week)

### Priority 1 (Today): RPC Endpoints
- [ ] Add `stakeToMossStake` method
- [ ] Add `getStakingPosition` method
- [ ] Add `getMossStakePoolInfo` method
- [ ] Test via curl

### Priority 2 (Tomorrow): Wallet UI
- [ ] Remove staking tab hiding
- [ ] Add community staking form
- [ ] Add stLICN balance display
- [ ] Test in browser

### Priority 3 (This Week): Integration
- [ ] Wire MossStake to validator
- [ ] Add reward distribution
- [ ] End-to-end test
- [ ] Deploy to testnet

---

**Status**: Ready to implement  
**Complexity**: High (full-stack changes)  
**Timeline**: 2-3 weeks to production  
**Priority**: HIGH (user requested "activate now")
