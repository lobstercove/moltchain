# MoltChain BFT Consensus Deep Audit

> **Date**: 2026-03-17  
> **Scope**: Complete audit of MoltChain's BFT consensus engine, P2P layer, sync mechanism, validator set management, and crash recovery — compared line-by-line against CometBFT (Tendermint), Ethereum 2.0, and Solana.  
> **Verdict**: MoltChain has a solid foundation but has **11 critical gaps** vs production blockchain standards that MUST be addressed before the chain can safely run with dynamic validator sets.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What Was Done Right](#2-what-was-done-right)
3. [What v0.4.1/v0.4.2 Changed (and What Broke)](#3-what-v041v042-changed)
4. [Critical Gap Analysis vs Real Blockchains](#4-critical-gap-analysis)
5. [Gap Details — With CometBFT/Ethereum/Solana References](#5-gap-details)
6. [Root Cause of the Current Stall](#6-root-cause-of-current-stall)
7. [Fix Plan — Ordered by Priority](#7-fix-plan)
8. [Comparison Matrix](#8-comparison-matrix)

---

## 1. Executive Summary

### What the BLOCKCHAIN_ALIGNMENT_PLAN.md covered (39 findings — all DONE)

The existing alignment plan was thorough on **economics, state management, EVM compatibility, contract features, and wire format**:
- ✅ Inflationary supply model (Ethereum/Solana-style)
- ✅ Block commit certificates (CometBFT-style)
- ✅ Merkle state proofs (light client primitives)
- ✅ Exponential BFT timeout backoff (CometBFT-style)
- ✅ Deterministic BFT timestamps (CometBFT BFT Time)
- ✅ Epoch-based staker rewards (Solana model)
- ✅ Durable nonces (Solana-style)
- ✅ EVM transaction envelopes
- ✅ Compute metering (Solana-style CU)
- ✅ Oracle multi-source attestation
- ✅ Governance parameter changes
- ✅ 20+ more features

### What the plan did NOT audit

The plan did not cover the **runtime behavior** of the BFT consensus engine — the actual state machine that makes blocks, handles validator joins/leaves, recovers from crashes, and maintains liveness. This is the part that is currently broken.

### The 11 Critical Gaps

| # | Gap | CometBFT | Ethereum | Solana | MoltChain |
|---|-----|----------|----------|--------|-----------|
| G-1 | **No WAL (Write-Ahead Log)** | ✓ WAL before every state change | ✓ Database journaling | ✓ Tower BFT persistence | ✗ In-memory only |
| G-2 | **No lock persistence** | ✓ Locked round persisted to WAL | N/A (Casper) | ✓ Last vote persisted | ✗ Lost on crash |
| G-3 | **No commit verification during sync** | ✓ Verifies 2/3+ sigs per block | ✓ Sync committee proofs | ✓ Vote account verification | ✗ Trusts blocks blindly |
| G-4 | **No consensus-triggered catch-up** | ✓ Catches up on receiving commit | N/A | ✓ Repair protocol | ✗ Only periodic timer |
| G-5 | **Decoupled consensus and application** | ✓ ABCI atomic commit | ✓ Engine API atomic | ✓ Bank freeze/commit | ✗ Separate goroutines |
| G-6 | **No validator set hash in header** | ✓ ValidatorsHash in header | ✓ Sync committee root | ✓ Vote accounts in bank | ✗ Implicit only |
| G-7 | **No formal state machine transitions** | ✓ Explicit FSM with guards | ✓ Fork choice spec | ✓ Explicit states | ✗ Ad-hoc if/else |
| G-8 | **Fork choice conflicts with BFT finality** | ✓ No fork choice needed | ✓ LMD-GHOST + FFG | N/A | ✗ Hybrid Nakamoto+BFT |
| G-9 | **No evidence reactor** | ✓ Dedicated evidence module | ✓ Slasher module | ✓ Gossip protocol | ✗ Basic detection only |
| G-10 | **BFT messages buffered for future heights** | ✓ Buffered + replayed | ✓ Attestation pool | ✓ Vote caching | ✗ Dropped/ignored |
| G-11 | **No graceful validator entry protocol** | ✓ EndBlock + 1-height delay | ✓ Entry queue + 1 epoch | ✓ Leader schedule epoch | ✗ Immediate+deferred hybrid |

---

## 2. What Was Done Right

### BFT State Machine Core (validator/src/consensus.rs)

The core consensus state machine is **well-designed** and matches CometBFT's fundamental algorithm:

1. **Propose → Prevote → Precommit → Commit phases**: Correct 4-phase structure matching Tendermint paper §2.
2. **2/3+ stake-weighted supermajority**: `has_supermajority_voters()` correctly computes `vote_stake * 3 >= total_eligible_stake * 2`.
3. **Locked round / locked value**: The safety mechanism that prevents validators from voting for conflicting blocks. Correctly implemented:
   - Set when observing 2/3+ prevotes for a block
   - Must prevote for locked block unless POL unlock applies
4. **Valid round / valid value**: The liveness mechanism for re-proposing previously polka'd blocks. Correctly implemented.
5. **POL unlock rule**: If `valid_round > locked_round` AND polka exists for the new block, prevote for it. This is textbook CometBFT.
6. **Exponential timeout backoff**: `base × 1.5^round`, capped at 60s. Matches CometBFT.
7. **Round-skip (f+1 rule)**: If >1/3 of stake has voted in a future round, skip to that round. Aggregated across all future rounds (correct CometBFT behavior).
8. **Single-sign enforcement**: `signed_prevote_rounds` and `signed_precommit_rounds` prevent double-signing in the same round.
9. **Commit certificate collection**: `collect_commit_signatures()` gathers precommit signatures at commit time — exactly what CometBFT does.
10. **BFT Time (deterministic timestamps)**: Stake-weighted median of commit timestamps. Direct CometBFT PBTS implementation.

**Verdict**: The consensus algorithm itself is **correctly implementing Tendermint BFT**. The problems are in the **integration layer** — how the algorithm interacts with the rest of the system.

### Height-Frozen Validator Set Snapshots (v0.4.1)

This fix is **correct and matches CometBFT**:
- CometBFT: Validator set changes take effect at H+1, never mid-height
- MoltChain: `height_vs` and `height_pool` cloned at start of each height, passed immutably to all BFT methods
- Prevents quorum denominator shifts mid-round

### Commit Certificates (BLOCKCHAIN_ALIGNMENT_PLAN Task 1.2)

2/3+ precommit signatures attached to committed blocks. This is exactly how CometBFT proves finality to light clients.

---

## 3. What v0.4.1/v0.4.2 Changed (and What Broke)

### Change 1: Height-Frozen Validator Set Snapshots ✅ CORRECT
- **What**: Clone ValidatorSet and StakePool at start of each height
- **CometBFT equivalent**: Internal validator set is read-only during consensus round
- **Impact**: Fixed the 3→4 validator stall (quorum denominator shift)
- **Status**: Working correctly

### Change 2: Round-Skip Aggregation ✅ CORRECT
- **What**: Changed from per-round f+1 counting to aggregate across all future rounds
- **CometBFT equivalent**: `check_peer_state()` in consensus/state.go considers all future round votes
- **Impact**: Fixed round cycling without convergence
- **Status**: Working correctly

### Change 3: BFT Relay on Validators ✅ CORRECT BUT INCOMPLETE
- **What**: Enabled BFT message relay on Validator-role nodes (was only on Relay/Seed)
- **CometBFT equivalent**: All nodes relay consensus messages (reactor pattern)
- **Impact**: BFT messages now propagate between validators that aren't directly connected
- **Problem**: Still broadcasts proposals to all peers but prevotes/precommits only to validator peers. In a small network this works, but in a larger network non-validator relay nodes don't forward BFT messages efficiently.

### Change 4: Periodic Sync Trigger ❌ INTRODUCED BUG
- **What**: Added 5-second interval timer in block receiver to check `should_sync()`
- **Bug**: The sync completion handler was added but there was a period where `start_sync()` was called without spawning the async completion task, leaving `is_syncing = true` forever
- **CometBFT equivalent**: CometBFT has a dedicated Block Sync reactor with proper request tracking
- **Current status**: Bug was patched (completion handler added), but the fundamental design is fragile — a timer-based sync trigger is not how production blockchains do catch-up

### Change 5: BFT Message Dedup ✅ CORRECT
- **What**: Content-based SHA-256 hashing for dedup instead of message-ID only
- **CometBFT equivalent**: All messages are deduplicated by content in the reactor
- **Impact**: Prevents duplicate processing of relayed messages
- **Status**: Working correctly

### Why the Chain Diverged

The chain didn't diverge because the BFT algorithm is wrong. It diverged because:

1. **Bug in sync trigger** → `is_syncing` stuck → some nodes couldn't catch up
2. **No consensus-triggered catch-up** → when a validator receives a committed block for its current height from a peer, it should IMMEDIATELY skip BFT and accept the block. Instead, it only catches up via the 5-second periodic timer.
3. **Validator set hash included mutable fields** → spurious "validator set mismatch" warnings confused the debugging (this was a logging issue, not a consensus issue)
4. **No WAL** → when a node was restarted, it lost its consensus state and started fresh, potentially voting differently

---

## 4. Critical Gap Analysis

### Severity Levels

- **SAFETY**: Can cause chain fork or double-spend (violates BFT safety guarantee)
- **LIVENESS**: Can cause chain stall or inability to produce blocks
- **OPERATIONAL**: Makes operations fragile, recovery difficult, debugging hard

---

## 5. Gap Details

### G-1: No Write-Ahead Log (WAL) — SAFETY + LIVENESS

**What CometBFT does** (consensus/wal.go):
```
Before ANY state transition:
1. Write message to WAL file (fsync to disk)
2. Process message (update state machine)
3. On crash recovery: replay WAL from last checkpoint
```

CometBFT's WAL records:
- Every received proposal, prevote, precommit
- Every timeout event
- Every state transition (step changes)
- The commit decision

On restart, CometBFT replays the WAL and arrives at the exact same state as before the crash. A validator cannot "forget" that it already voted.

**What MoltChain does**:
- All consensus state is in-memory (the `ConsensusEngine` struct)
- On crash: `start_height()` resets everything — locked_round, locked_value, votes, step
- No record of previous votes or locks

**Risk**:
- **Safety violation**: Validator crashes after precommitting block A at round R. Restarts. Lost its `locked_value`. In round R+1, votes for block B. If >1/3 of validators do this simultaneously, two conflicting blocks could each get 2/3+ precommits → **chain fork**.
- **Practical mitigation**: Requires coordinated crash + Byzantine coordination. Unlikely with 4 honest validators, but fundamentally unsafe.

**What Ethereum 2.0 does**: Maintains a slashing protection database (EIP-3076) that persists the last vote height. Validators refuse to vote below their last persisted height.

**What Solana does**: Tower BFT persists last vote to tower file. On restart, loads tower and refuses to vote conflicting.

---

### G-2: No Lock Persistence — SAFETY

Closely related to G-1. CometBFT persists `locked_round` and `locked_value` as part of the WAL. Solana persists its vote tower. Ethereum persists the slashing protection DB.

MoltChain's `locked_round` and `locked_value` are fields on the `ConsensusEngine` struct — gone on restart.

**Fix**: Must be part of the WAL implementation (G-1).

---

### G-3: No Commit Verification During Sync — SAFETY

**What CometBFT does** (blocksync/reactor.go):
```
For EVERY block received during sync:
1. Verify block has valid commit (2/3+ precommit signatures)
2. Verify commit signatures against validator set at that height
3. Only then apply the block
```

**What Ethereum does**: Sync committee signatures verified during checkpoint sync.

**What MoltChain does**:
- During catch-up sync, blocks are applied WITHOUT verifying commit signatures
- The comment in block receiver says "trust PoS finality" during InitialSync
- Only the producer's signature is checked, not the commit certificate

**Risk**:
- A malicious peer could feed a node fake blocks during sync
- Node would accept and apply them, ending up on a fork
- In a production network with untrusted peers, this is a critical vulnerability

---

### G-4: No Consensus-Triggered Catch-Up — LIVENESS

**What CometBFT does** (consensus/state.go):
```
On receiving a commit for current height:
  → Immediately apply the committed block
  → Skip remaining BFT rounds
  → Advance to next height
  
On receiving votes for height > current:
  → Detect we're behind
  → Enter block sync mode immediately
```

**What MoltChain does**:
- BFT engine runs in one goroutine, block receiver in another
- When the block receiver gets a committed block (via CompactBlock), it applies it to state
- But the BFT engine doesn't know about it until the next iteration of the select! loop checks `get_last_slot()`
- There is NO channel from block receiver to BFT engine saying "height already committed, skip"
- The periodic sync runs every 5 seconds — a node behind by 1 block waits up to 5 seconds before realizing

**Risk**:
- Slow catch-up after brief network disruption
- Validators can be stuck in BFT rounds for a height that's already been committed elsewhere
- Wasted network bandwidth on BFT messages for already-committed heights

**What should happen**: When a node receives a committed block for its current BFT height, it should **instantly** cancel its BFT round and advance. This is what CometBFT does.

---

### G-5: Decoupled Consensus and Block Application — LIVENESS + OPERATIONAL

**What CometBFT does** (ABCI interface):
```
Consensus commits a block:
  1. Call ABCI.FinalizeBlock(block) → application processes all TXs
  2. Call ABCI.Commit() → application persists state
  3. Update consensus state (WAL checkpoint)
  All three steps are ATOMIC — either all succeed or all fail
```

**What MoltChain does**:
- BFT engine returns `ConsensusAction::CommitBlock`
- `execute_consensus_actions()` applies the block:
  - Replays transactions via TxProcessor
  - Calls `apply_block_effects()`
  - Writes to RocksDB
  - Updates mempool
- These steps are NOT atomic — if the process crashes between steps, state can be partially applied

**Risk**:
- Process crashes after `put_block()` but before `apply_block_effects()`:
  - Block is stored but effects (validator set, staking) not applied
  - On restart, block appears committed but state is incomplete
- No transaction-level atomicity for the commit step

**What should happen**: Use RocksDB WriteBatch for the entire commit (block + effects + state updates) as a single atomic operation. MoltChain already has `StateBatch` — it should be used for the commit path.

---

### G-6: No Validator Set Hash in Block Header — OPERATIONAL

**What CometBFT does**:
```
Block.Header.ValidatorsHash = MerkleRoot(validators sorted by address)
Block.Header.NextValidatorsHash = MerkleRoot(next_validators)
```

This allows any node to verify that a block was produced under the correct validator set without replaying state.

**What Ethereum does**: Stores sync committee root in beacon block header.

**What MoltChain does**: Block header contains `slot | parent_hash | state_root | tx_root | timestamp | validator | signature`. No validator set hash.

**Risk**:
- Light clients cannot verify which validator set was active at a given height without replaying all blocks
- Commit certificate verification requires the full state (not just the header)
- Makes IBC integration harder (IBC requires validator set hash for light client verification)

---

### G-7: No Formal State Machine Transitions — OPERATIONAL

**What CometBFT does** (consensus/state.go):
```go
func (cs *State) handleMsg(mi msgInfo) {
    switch msg := mi.Msg.(type) {
    case *ProposalMessage:
        cs.handleProposal(msg) // explicit transition guards
    case *VoteMessage:
        cs.handleVote(msg)     // each returns error if invalid state
    ...
    }
}
```

Every transition has explicit guards: "must be in step X to process message of type Y". State transitions are logged and traceable.

**What MoltChain does**: The consensus engine methods (`on_proposal`, `on_prevote`, `on_precommit`) have inline checks but no formal state transition table. For example:
- `on_proposal()` checks `self.step == Propose` but embeds the logic
- `on_prevote()` has 4 different code paths based on vote tallies
- There's no single place that documents "from state X, receiving message Y → transition to state Z"

**Risk**:
- Hard to audit for correctness
- Hard to prove safety properties
- Bug-prone when modifying (each change must account for all possible states)

---

### G-8: Fork Choice Conflicts with BFT Finality — OPERATIONAL

**What CometBFT does**: There is NO fork choice. BFT finality means exactly one block per height. If you have a commit certificate, that block is final. Period.

**What MoltChain does**: Has BOTH:
1. BFT consensus (Tendermint-style instant finality)
2. Fork choice oracle (Nakamoto-style longest chain + vote weight)

The block receiver evaluates fork choice when receiving a block at the same height as an existing block. This creates a contradiction:
- BFT says: "block committed with 2/3+ precommits is FINAL"
- Fork choice says: "compare vote weights, maybe replace the block"

**Risk**:
- A finalized block could theoretically be replaced if fork choice prefers an alternative
- The finality guard (`if block_slot <= current_finalized { continue; }`) mitigates this, but the mere existence of fork choice for BFT-committed blocks is a design smell
- Confuses the codebase: which is authoritative — BFT or fork choice?

**What should happen**: Remove fork choice for heights that have commit certificates. Fork choice should ONLY apply during sync when commit certificates are missing.

---

### G-9: No Evidence Reactor — SAFETY

**What CometBFT does** (evidence/reactor.go):
```
Dedicated evidence module:
1. Collects Byzantine evidence (double-voting, equivocation)
2. Validates evidence against historical validator sets
3. Gossips evidence to all peers
4. Block proposer includes valid evidence in block
5. Application processes evidence → slash validator
```

All evidence is gossiped proactively and included in blocks automatically.

**What MoltChain does**:
- `SlashingTracker` in core detects double-blocks locally
- Evidence is logged but NOT automatically included in blocks
- No gossip protocol for evidence
- `SlashValidator` opcode (27) exists but there's no automated path from evidence detection to on-chain slashing

**Risk**:
- Byzantine validators can double-vote without consequence
- Evidence detected by one node is not propagated to others
- No automated slashing pipeline

---

### G-10: BFT Messages for Future Heights Not Buffered — LIVENESS

**What CometBFT does** (consensus/state.go):
```go
// Buffer votes from future heights/rounds
if vote.Height > cs.Height {
    cs.addFutureVote(vote)  // Cached and replayed when we reach that height
}
```

CometBFT maintains a "peer round state" and buffers messages from heights it hasn't reached yet. When it advances to that height, it replays them.

**What MoltChain does**: The BFT engine only processes messages for its current height:
- `on_proposal()`: Checks `proposal.height == self.height`
- `on_prevote()`: Checks `prevote.height == self.height`
- `on_precommit()`: Checks `precommit.height == self.height`

Messages for future or past heights are silently dropped.

**Risk**:
- If a slow validator receives votes for height H+1 while still at height H, those votes are lost
- When it advances to H+1, it must wait for votes to be re-broadcast
- In a 4-validator network, this delays consensus by at least one full timeout duration

---

### G-11: No Graceful Validator Entry Protocol — LIVENESS (THIS CAUSED THE STALL)

**What CometBFT does** (state/execution.go):
```go
// EndBlock returns ValidatorUpdates
// Applied at the END of the current height
// Active at height H+1
// Validator set is computed deterministically from state
```

Key: The validator set change is **deterministic** — all nodes compute the same set at the same height because EndBlock runs identically on all nodes.

**What Solana does**: Leader schedule is computed at the start of each epoch from the stake distribution at the epoch snapshot. New validators in the current epoch become eligible for the NEXT epoch's leader schedule.

**What MoltChain does**:
1. `RegisterValidator` TX is included in a block
2. `process_transaction()` adds validator to stake pool immediately
3. `apply_block_effects()` reloads stake pool from state, updates ValidatorSet
4. BFT engine picks up the new validator at the start of the NEXT height via height-frozen snapshot

**What went wrong with 4th validator join**:
- Block at slot 3331 included RegisterValidator for Mac Mini (DBeWr6V...)
- Before the height-frozen snapshot fix: the validator was picked up MID-height
- Quorum denominator changed from 3 validators (need 2/3 = 200K stake) to 4 validators (need 2/3 = 267K stake)
- Two validators' votes (200K) no longer sufficient — stall
- After the fix: new validator deferred to next height — but other sync issues prevented convergence

**What's still missing**:
- No explicit validator set change event/log that all nodes can verify
- No epoch-boundary batching (CometBFT batches changes per block, Ethereum per epoch)
- Leader selection uses `select_leader_weighted_with_seed()` but the seed is `parent_hash` — if validators disagree on the parent (during a fork), they disagree on the leader → different proposals → divergence

---

## 6. Root Cause of the Current Stall

The chain stall at ~slot 3355 had multiple contributing factors:

### Primary Cause: Sync Bug (v0.4.2)
The periodic sync trigger called `start_sync()` without always spawning the completion handler. `is_syncing` got stuck as `true` forever on some nodes. A node with `is_syncing = true` cannot trigger new sync batches, so it permanently falls behind.

### Secondary Cause: No Consensus-Triggered Catch-Up (G-4)
When a validator receives a committed block from a peer for its current BFT height, it should immediately adopt it and advance. Instead, it continues BFT rounds for a height that's already been committed elsewhere. This means:
- Validator A commits block 3356
- Validator B is still in BFT round 5 for height 3356
- Validator B receives block 3356 via P2P
- Block receiver applies it to state
- But BFT engine doesn't know — continues rounds
- Eventually BFT engine detects `get_last_slot() >= height` and advances
- But by then, A is already at 3357 and B lost the proposal window

### Tertiary Cause: Validator Set Divergence During Sync
Different nodes had different views of which slot they were at (EU=3357, US=3355, Mac=3353). This means they had different `parent_hash` values. Since leader selection uses `parent_hash` as seed:
- If EU is at 3357, it selects leader based on block 3357's hash
- If US is at 3355, it selects leader based on block 3355's hash
- Different leaders → different proposals → votes don't converge → stall

### Root Fix Required
The fundamental fix is NOT more patches to the sync timer. It is:
1. **Consensus-triggered catch-up** (G-4): When BFT engine receives evidence that its height is committed, skip immediately
2. **WAL** (G-1): Persist consensus state so crashes don't cause divergence
3. **Commit verification during sync** (G-3): Verify 2/3+ signatures on every synced block so all nodes converge to the same canonical chain

---

## 7. Fix Plan — Ordered by Priority

### Priority 1: LIVENESS (Fix the Stall)

#### Fix F-1: Consensus-Triggered Catch-Up (Fixes G-4, G-10)
**Reference**: CometBFT consensus/state.go `tryAddVote()` + `enterNewBlock()`

**Implementation**:
1. Add a `committed_block_rx: mpsc::Receiver<(u64, Hash)>` channel from block receiver to BFT loop
2. When block receiver accepts a committed block at height H:
   - Send `(H, block_hash)` on the channel
3. In the BFT select! loop, add a new arm:
   ```rust
   Some((committed_height, committed_hash)) = committed_block_rx.recv() => {
       if committed_height >= bft.height {
           // Skip BFT — height already committed
           bft.start_height(committed_height + 1);
           height_vs = validator_set.read().await.clone();
           height_pool = stake_pool.read().await.clone();
           parent_hash = committed_hash;
           // Continue to propose/wait for next height
       }
   }
   ```
4. Also buffer future-height BFT messages: When receiving a proposal/vote for height > current, store in a bounded buffer. On advancing to that height, replay them.

**Files**: `validator/src/main.rs`, `validator/src/consensus.rs`
**Tests**: Simulate committed block received during BFT round → verify instant advance

#### Fix F-2: Atomic Block Commit (Fixes G-5)
**Reference**: CometBFT ABCI `FinalizeBlock` + `Commit`

**Implementation**:
1. In `execute_consensus_actions()` for `CommitBlock`:
   - Create a `StateBatch`
   - Add block storage to batch
   - Add all effects (rewards, staking, validator set) to batch
   - Commit entire batch atomically
2. On crash recovery: Check if last block is fully applied by verifying state root matches block's state_root

**Files**: `validator/src/main.rs`, `core/src/state.rs`
**Tests**: Kill process mid-commit → restart → verify consistent state

### Priority 2: SAFETY (Prevent Forks)

#### Fix F-3: Write-Ahead Log (Fixes G-1, G-2)
**Reference**: CometBFT consensus/wal.go

**Implementation**:
1. Create `validator/src/wal.rs` module
2. **WAL message types**: Proposal received, Prevote sent, Precommit sent, Timeout fired, CommitDecision, HeightStart
3. **Write path**: Before every state transition in ConsensusEngine, write to WAL file
   ```rust
   pub fn log_message(&mut self, msg: WalMessage) -> io::Result<()> {
       let bytes = bincode::serialize(&msg)?;
       self.file.write_all(&(bytes.len() as u32).to_le_bytes())?;
       self.file.write_all(&bytes)?;
       self.file.sync_data()?; // fsync
       Ok(())
   }
   ```
4. **Replay on startup**: Read WAL from last checkpoint, replay all messages through ConsensusEngine
5. **Checkpoint**: After commit, truncate WAL to reduce replay time
6. **Persist locked_round/locked_value**: These MUST survive restarts. Either as part of WAL or separate file.

**Files**: `validator/src/wal.rs` (new), `validator/src/consensus.rs`, `validator/src/main.rs`
**Tests**: Write WAL → kill process → restart → verify same consensus state

#### Fix F-4: Commit Verification During Sync (Fixes G-3)
**Reference**: CometBFT blocksync/reactor.go `poolRoutine()`

**Implementation**:
1. When receiving blocks during sync, verify commit certificates:
   ```rust
   if !block.verify_commit(round, &validator_set_at_height, &stake_pool_at_height) {
       warn!("Rejecting block {} — invalid commit certificate", block.header.slot);
       continue;
   }
   ```
2. This requires tracking the validator set at each height during sync (can be derived by replaying blocks)
3. For headers-only sync: still verify commit signatures (they're in the header)

**Files**: `validator/src/main.rs`
**Tests**: Feed node a block with invalid commit → verify rejection

### Priority 3: OPERATIONAL (Robustness)

#### Fix F-5: Remove Fork Choice for BFT Heights (Fixes G-8)
**Reference**: CometBFT has no fork choice

**Implementation**:
1. When receiving a block at same height as existing block:
   - If existing block has a valid commit certificate → keep it, reject incoming
   - If neither has commit certificate (shouldn't happen in normal BFT) → keep existing
2. Remove the vote weight / oracle comparison for committed blocks
3. Fork choice should ONLY apply during initial sync when commit certificates might be missing (and even then, prefer blocks WITH certificates)

**Files**: `validator/src/main.rs`

#### Fix F-6: Validator Set Hash in Block Header (Fixes G-6)
**Reference**: CometBFT types/block.go `Header.ValidatorsHash`

**Implementation**:
1. Add `validators_hash: Hash` field to `BlockHeader`
2. Compute as: `SHA-256(sorted validator pubkeys + stakes)`
3. Exclude mutable operational fields (joined_slot, last_active_slot, blocks_proposed)
4. Verify at block reception: recompute validators_hash and compare
5. `#[serde(default)]` for backward compatibility

**Files**: `core/src/block.rs`, `validator/src/main.rs`, `validator/src/block_producer.rs`

#### Fix F-7: Evidence Reactor (Fixes G-9)
**Reference**: CometBFT evidence/reactor.go

**Implementation**:
1. When double-vote detected:
   - Package as `SlashingEvidence` with both conflicting messages
   - Broadcast via dedicated P2P message type (already exists: `MessageType::SlashingEvidence`)
   - Block proposer includes pending evidence in next block
2. `SlashingTracker.get_pending_evidence()` → proposer includes in block
3. `process_slashing_evidence()` in block processing automatically slashes

**Files**: `validator/src/main.rs`, `core/src/consensus.rs`

#### Fix F-8: Future Message Buffer (Fixes G-10)
**Reference**: CometBFT consensus/state.go `addFutureVote()`

**Implementation**:
1. Add to ConsensusEngine:
   ```rust
   future_proposals: BTreeMap<u64, Vec<Proposal>>,  // keyed by height
   future_prevotes: BTreeMap<u64, Vec<Prevote>>,
   future_precommits: BTreeMap<u64, Vec<Precommit>>,
   ```
2. Messages for `height > self.height`: store in future buffer (bounded, e.g., 1000 per type)
3. In `start_height(h)`: drain all buffered messages for height `h`, process them

**Files**: `validator/src/consensus.rs`

#### Fix F-9: Formal State Machine (Fixes G-7)
**Reference**: CometBFT consensus STATE_MACHINE.md

**Implementation**:
1. Document the state transition table:
   ```
   (Propose, ProposalMsg) → Prevote
   (Prevote, 2/3+Block) → Precommit + Lock
   (Prevote, 2/3+Nil) → Precommit(Nil)
   (Prevote, Timeout) → Precommit(Nil)
   (Precommit, 2/3+Block) → Commit
   (Precommit, 2/3+Nil) → NextRound
   (Precommit, Timeout) → NextRound
   (AnyStep, f+1 future) → SkipRound
   ```
2. Add transition guard at the top of each handler:
   ```rust
   pub fn on_proposal(&mut self, ...) -> ConsensusAction {
       // Guard: only process proposals in Propose step
       if self.step != RoundStep::Propose && self.step != RoundStep::Prevote {
           return ConsensusAction::None;
       }
       // ... rest of logic
   }
   ```
3. Log every state transition with before/after state

**Files**: `validator/src/consensus.rs`, `docs/consensus/STATE_MACHINE.md` (new)

#### Fix F-10: Validator Set Hash Excludes Mutable Fields
**Reference**: Already identified — validator set hash should exclude `joined_slot`, `last_active_slot`, `blocks_proposed`

**Implementation**: Already partially done, needs to be made formal in F-6.

#### Fix F-11: Graceful Validator Entry (Fixes G-11)
**Reference**: CometBFT EndBlock, Solana epoch boundaries

**Implementation**: The current approach (deferred to next height via frozen snapshot) is actually correct for CometBFT-style. The issue is that all nodes must agree on WHEN the validator enters. The fix is:
1. Include `validators_hash` in block header (F-6) — proves all nodes agree on the set
2. Ensure leader selection uses a COMMITTED parent hash (not a local tip hash)
3. Add validator activation event to WebSocket for observability

---

## 8. Comparison Matrix

### Consensus Engine

| Feature | CometBFT | Ethereum 2.0 | Solana | MoltChain Now | MoltChain Target |
|---------|----------|-------------|--------|--------------|-----------------|
| Core algorithm | Tendermint BFT | Casper FFG + LMD-GHOST | Tower BFT | Tendermint BFT ✅ | Same |
| Finality | Instant (1 block) | 2 epochs (~13 min) | ~32 slots | Instant ✅ | Same |
| WAL | ✅ fsync'd | ✅ DB journal | ✅ Tower file | ❌ None | ✅ WAL (F-3) |
| Lock persistence | ✅ In WAL | ✅ Slashing DB | ✅ Tower file | ❌ In-memory | ✅ In WAL (F-3) |
| Locked round | ✅ | N/A | N/A | ✅ | Same |
| POL unlock | ✅ | N/A | N/A | ✅ | Same |
| Timeout backoff | ✅ Exponential | N/A | N/A | ✅ Exponential | Same |
| Round-skip (f+1) | ✅ | N/A | N/A | ✅ Aggregate | Same |
| Commit certs | ✅ In block | ✅ Sync committees | ✅ Vote accounts | ✅ CommitSignature | Same |
| BFT timestamps | ✅ Median | ✅ Slot time | ✅ PoH clock | ✅ Weighted median | Same |
| State machine | ✅ Formal FSM | ✅ Formal spec | ✅ Formal spec | ⚠️ Informal | ✅ Formal (F-9) |
| Future msg buffer | ✅ | ✅ | ✅ | ❌ | ✅ (F-8) |
| Catch-up from commit | ✅ | ✅ | ✅ | ❌ Timer only | ✅ (F-1) |

### P2P & Sync

| Feature | CometBFT | Ethereum 2.0 | Solana | MoltChain Now | MoltChain Target |
|---------|----------|-------------|--------|--------------|-----------------|
| Block sync | ✅ Block Sync reactor | ✅ Range sync | ✅ Repair protocol | ⚠️ Timer-based | ✅ Event-driven (F-1) |
| Commit verification | ✅ Every block | ✅ Sync committee | ✅ Vote account | ❌ Trust during sync | ✅ Verify always (F-4) |
| State sync | ✅ Snapshot + verify | ✅ Snap sync | ✅ Snapshot | ⚠️ Partial (Warp mode) | ✅ Full state sync |
| Fork choice | ❌ Not needed | ✅ LMD-GHOST | ✅ Tower vote | ⚠️ Hybrid | ✅ Remove for BFT (F-5) |
| Evidence gossip | ✅ Evidence reactor | ✅ Slasher | ✅ Gossip protocol | ⚠️ Local detection only | ✅ Auto-include (F-7) |
| DHT/PEX | ✅ PEX reactor | ✅ discv5 | ✅ Gossip protocol | ✅ Kademlia + PEX | Same |
| Message dedup | ✅ Content-based | ✅ Content-based | ✅ Content-based | ✅ SHA-256 content | Same |

### Validator Set Management

| Feature | CometBFT | Ethereum 2.0 | Solana | MoltChain Now | MoltChain Target |
|---------|----------|-------------|--------|--------------|-----------------|
| Val set in header | ✅ ValidatorsHash | ✅ Sync committee root | ✅ Vote accounts | ❌ | ✅ (F-6) |
| Change activation | EndBlock (H+1) | Epoch boundary | Epoch boundary | Next height ✅ | Same |
| Frozen per height | ✅ | ✅ | ✅ | ✅ (v0.4.1) | Same |
| Deterministic set | ✅ | ✅ | ✅ | ✅ | Same |
| Entry queue | ❌ | ✅ (churn limit) | ❌ | ❌ | Consider |
| Atomic commit | ✅ | ✅ | ✅ | ❌ | ✅ (F-2) |

### Crash Recovery

| Feature | CometBFT | Ethereum 2.0 | Solana | MoltChain Now | MoltChain Target |
|---------|----------|-------------|--------|--------------|-----------------|
| WAL | ✅ | ✅ DB | ✅ Tower file | ❌ | ✅ (F-3) |
| Replay on restart | ✅ | ✅ | ✅ | ❌ Start fresh | ✅ (F-3) |
| Amnesia detection | ✅ | ✅ Slashing DB | ✅ | ❌ | ✅ (F-3) |
| Partial commit recovery | ✅ | ✅ | ✅ | ❌ | ✅ (F-2) |

---

## Summary

**MoltChain's BFT consensus algorithm is correctly implementing Tendermint BFT.** The core state machine — propose/prevote/precommit/commit with locked rounds, POL unlocks, exponential timeouts, and stake-weighted supermajority — matches the published Tendermint paper and CometBFT's implementation.

**The gaps are in the integration layer:**
1. No crash recovery (WAL + lock persistence)
2. No sync-consensus bridge (catch-up from committed blocks)
3. No commit verification during sync
4. No atomic block commit
5. Fork choice that conflicts with BFT finality

**Priority order for fixes:**
1. **F-1**: Consensus-triggered catch-up (fixes the current stall)
2. **F-2**: Atomic block commit (prevents partial state)
3. **F-3**: WAL (prevents safety violations on crash)
4. **F-4**: Commit verification during sync (prevents fake chain attacks)
5. **F-5**: Remove fork choice for BFT heights (simplifies, prevents conflicts)
6. **F-6**: Validator set hash in header (enables verification)
7. **F-7**: Evidence reactor (automated slashing)
8. **F-8**: Future message buffer (faster convergence)
9. **F-9**: Formal state machine (auditability)

The first four fixes (F-1 through F-4) are required before the chain can safely run with dynamic validator sets. The rest improve robustness and standards compliance.

---

*This audit was conducted by examining every line of the BFT consensus engine (validator/src/consensus.rs), the block receiver and BFT event loop (validator/src/main.rs), the P2P message layer (p2p/src/network.rs, p2p/src/peer.rs), and the sync manager (validator/src/sync.rs), comparing against CometBFT v0.38 source (consensus/state.go, consensus/wal.go, blocksync/reactor.go, evidence/reactor.go), Ethereum 2.0 consensus spec, and Solana Tower BFT documentation.*
