# Lichen Full Production Audit — March 8, 2026

**Scope:** Complete codebase audit (~92K lines across validator, core, custody, faucet, P2P, RPC, contract VM)  
**Auditor:** Automated deep analysis  
**Focus:** Bugs, race conditions, ordering issues, security vulnerabilities, production optimizations  
**Cross-referenced with:** Previous audits (CORE_AUDIT_REPORT.md, CORE_PRODUCTION_READINESS_AUDIT.md)

---

## Executive Summary

| Severity | Count | Categories |
|----------|-------|------------|
| **CRITICAL** | 8 | Consensus, state consistency, P2P, custody |
| **HIGH** | 18 | Ordering, race conditions, DoS, key management |
| **MEDIUM** | 15 | Resource leaks, rate limiting, input validation |
| **LOW** | 8 | Performance, best practices, documentation |
| **TOTAL** | **49** | |

---

## CRITICAL FINDINGS (Fix Before Scaling)

### C1. Validator Set Race in Leader Election
**File:** [validator/src/main.rs](../validator/src/main.rs) ~L10170-10200  
**Issue:** Leader election reads `validator_set` and `stake_pool` via RwLock, but releases locks before using the selected leader pubkey. Between lock release and usage, the validator announcement handler can mutate `validator_set`, causing leader election results to diverge across validators.  
**Impact:** Different validators disagree on block producer → forks every slot  
**Fix:** Keep both locks held through the entire leader selection + comparison, or snapshot the result atomically.

---

### C2. P2P Gossip Deduplication Uses Timestamp (Non-Deterministic)
**File:** [p2p/src/peer.rs](../p2p/src/peer.rs) ~L1139-1150  
**Issue:** `SeenMessageCache` deduplicates by hashing the FULL serialized P2P message including `timestamp`. When the same block is relayed at slightly different times, timestamps differ → hashes differ → no deduplication → message amplification loops.  
**Impact:** Exponential message amplification in relay network with many validators  
**Fix:** Hash only the consensus-relevant payload (block header hash, vote content), not wrapper timestamp.

---

### C3. CompactBlock Oracle Prices Not Signed
**File:** [p2p/src/message.rs](../p2p/src/message.rs) ~L67-79  
**Issue:** `CompactBlock.oracle_prices: Vec<(String, u64)>` has no cryptographic proof of origin. Relay nodes can MITM oracle prices embedded in compact blocks, injecting fake price data to downstream validators.  
**Impact:** Validators receiving compact blocks could apply manipulated oracle prices  
**Fix:** Oracle prices should be part of the block header hash (already hashed in full blocks), or compact blocks should include the block header signature which covers oracle_prices.

---

### C4. Custody Burn Verification Hangs on Unconfigured Contract
**File:** [custody/src/main.rs](../custody/src/main.rs) ~L6813-6816  
**Issue:** When a wrapped token contract address is not configured (e.g., new asset added without config update), the burn verification logs an error and `continue;` — skipping to the next job. The job stays in `pending_burn_verification` forever, retried every cycle infinitely. Never rejected, never progressed.  
**Impact:** Withdrawal jobs hang permanently; user funds locked  
**Fix:** Mark job as `permanently_failed` when no contract is configured, emit operator alert.

---

### C5. Custody Multi-Signer FROST Not Wired
**File:** [custody/src/main.rs](../custody/src/main.rs) ~L1007-1020  
**Issue:** Multi-signer FROST Ed25519 protocol code is compiled but the main signing loop uses single-round `/sign` endpoint, not 2-round FROST flow. When deploying with >1 signer, FROST signatures won't aggregate correctly.  
**Impact:** All multi-signer withdrawals/sweeps fail on-chain, locking funds  
**Fix:** Wire `collect_frost_signatures()` into sweep/withdrawal workers when `signer_endpoints.len() > 1`, or gate FROST code behind a feature flag with clear documentation.

---

### C6. P2P No Rate Limiting on Resource-Intensive Requests
**File:** [p2p/src/network.rs](../p2p/src/network.rs) ~L478-525  
**Issue:** Peers can spam `StatusRequest`, `SnapshotRequest`, `StateSnapshotRequest` without any per-peer rate limiting. Each snapshot chunk can be up to 16MB of account/contract data.  
**Impact:** Resource exhaustion / denial of service via repeated state snapshot requests  
**Fix:** Add per-peer request counter with moving-window rate limit (max 10 status/min, 1 snapshot/5min). Penalize peers exceeding limit.

---

### C7. RPC Prediction Market O(n) Full Scan
**File:** [rpc/src/prediction.rs](../rpc/src/prediction.rs) ~L800-850  
**Issue:** `GET /prediction-market/markets` iterates ALL markets to apply filters. Each market decode requires ~10 DB reads. With 1M markets → 10M reads per request. No pagination, no response size limit.  
**Impact:** Single API call can exhaust validator CPU and memory  
**Fix:** Add pagination (page_size default 50, max 200) + contract-side category/creator indexes.

---

### C8. RPC Launchpad Equity Calculation Overflow
**File:** [rpc/src/launchpad.rs](../rpc/src/launchpad.rs) ~L490-530  
**Issue:** `compute_buy_tokens` uses u128 math but silently caps result at `u64::MAX` instead of returning an error. A user requesting an enormous `after_fee_spores` value gets capped to u64::MAX tokens, potentially worth far more than paid.  
**Impact:** Free token generation exploit on launchpad  
**Fix:** Return error when tokens exceed u64::MAX instead of silent cap.

---

## HIGH FINDINGS

### H1. Compact Block Short-ID Collision
**File:** [validator/src/main.rs](../validator/src/main.rs) ~L8976  
**Issue:** Compact block reconstruction matches transactions by 8-byte hash prefix (`hash.0[..8]`). On collision, the first matching mempool transaction is used without full hash verification.  
**Practical risk:** Low (~1/2^32 per pair), but a targeted attack could craft transactions with colliding 8-byte prefixes to cause wrong-block reconstruction.  
**Fix:** After reconstruction, verify the reconstructed block hash matches the header's tx_root.

### H2. Watchdog Fires During Valid Sync
**File:** [validator/src/main.rs](../validator/src/main.rs) ~L10280-10320  
**Issue:** Watchdog checks `!is_actively_receiving()` which only returns true if pending block count > 0. During one-at-a-time sync, pending count temporarily drops to 0 between blocks. Watchdog kills validator even though it's validly syncing.  
**Fix:** Also track `last_block_received_time` — if a block was received recently, don't trigger watchdog.

### H3. Deadlock Breaker Fork Risk
**File:** [validator/src/main.rs](../validator/src/main.rs) ~L10580-10620  
**Issue:** Two validators with different `pubkey_jitter` values could both timeout at slightly different times and both produce blocks for the same slot during deadlock-breaking.  
**Fix:** Deterministic tiebreaker — only the LOWEST pubkey among online validators produces during deadlock break.

### H4. Block Receiver Votes Before Effects Verified
**File:** [validator/src/main.rs](../validator/src/main.rs) ~L6950-7000  
**Issue:** Finality tracking happens during voting (before `apply_block_effects`). If the block has invalid state transitions, finality was already marked on an invalid block.  
**Fix:** Apply effects BEFORE voting, or make votes provisional pending effect verification.

### H5. Custody No Memory Zeroization of Private Keys
**File:** [custody/src/main.rs](../custody/src/main.rs) ~L6066-6182  
**Issue:** Derived private keys (`signing_key`, `SimpleSolanaKeypair`) are stored in memory without `zeroize` on drop. Core dumps or memory introspection could recover plaintext key material.  
**Fix:** Use `zeroize::Zeroizing<>` wrapper for all private key types. Disable core dumps in systemd service (`LimitCORE=0`).

### H6. Custody Burn Amount/Caller Not Fully Verified Against Withdrawal
**File:** [custody/src/main.rs](../custody/src/main.rs) ~L4770-4800  
**Issue:** The `/withdrawals/:job_id/burn` endpoint accepts a burn_tx_signature, but there's no verification that the burned amount, asset, and caller in the on-chain transaction match the withdrawal request until Phase 1 processing (which may be delayed). During the gap, a previously-submitted burn for a different withdrawal could be reused.  
**Fix:** Include the `job_id` as a nonce in the burn transaction's instruction data.

### H7. P2P Eclipse Attack via Subnet Diversity
**File:** [p2p/src/peer.rs](../p2p/src/peer.rs) ~L234-242  
**Issue:** `MAX_PEERS_PER_SUBNET = 2` (per /24 subnet). An attacker with 10 IPs from 10 different /24 subnets can fill the entire peer table of a validator. No per-ASN or per-cloud-provider limits.  
**Fix:** Add per-ASN limits using GeoIP/BGP data. Require minimum geographic diversity.

### H8. P2P Gossip Deduplication Cache Too Small
**File:** [p2p/src/peer.rs](../p2p/src/peer.rs) ~L118-137  
**Issue:** `SeenMessageCache` holds 20K messages in FIFO order. At 10K TPS, cache covers only 2 seconds. After eviction, replayed messages bypass dedup.  
**Fix:** Increase capacity to 100K+ or use time-based eviction (keep entries for slot duration).

### H9. P2P Deserialization Failure Counter Resets On Success
**File:** [p2p/src/peer.rs](../p2p/src/peer.rs) ~L1145  
**Issue:** `deser_failures` counter resets to 0 on any successful message. Pattern `[9 bad, 1 good, repeat]` keeps connection alive indefinitely while sending garbage.  
**Fix:** Use time-windowed counter (>5 failures in 60s → disconnect). Don't fully reset on success.

### H10. P2P Hole Punch Amplification
**File:** [p2p/src/network.rs](../p2p/src/network.rs) ~L820-852  
**Issue:** Relay nodes forward `HolePunchNotify` to arbitrary `target_addr` without verifying it's a known peer. Attacker can use relay as traffic amplifier against arbitrary targets.  
**Fix:** Only relay hole-punch to known, connected peers. Rate-limit to max 6/min per target.

### H11. P2P Validator Announcement Replay
**File:** [p2p/src/network.rs](../p2p/src/network.rs) ~L621-645  
**Issue:** ValidatorAnnounce has no nonce/timestamp freshness check. Captured announcements can be replayed indefinitely for the same slot, potentially inflating reputation scores.  
**Fix:** Add nonce field. Track `last_announcement_slot` per validator. Reject if `current_slot <= last`.

### H12. P2P FindNode No Rate Limit
**File:** [p2p/src/network.rs](../p2p/src/network.rs) ~L689-696  
**Issue:** No rate limit on `FindNode` queries. Peer can spam millions of FindNode requests for different target IDs, keeping validator busy computing XOR distances.  
**Fix:** Max 100 FindNode per peer per minute.

### H13. P2P FindNodeResponse Address Validation Missing
**File:** [p2p/src/network.rs](../p2p/src/network.rs) ~L702-710  
**Issue:** Addresses from FindNodeResponse are parsed and added to kademlia table without validating they're not broadcast, multicast, or private IPs. Invalid entries can cause connection storms.  
**Fix:** Reject broadcast/multicast/reserved IPs. Penalize peer for invalid addresses.

### H14. P2P Reserved Peers Never Evicted
**File:** [p2p/src/peer.rs](../p2p/src/peer.rs) ~L1032-1047  
**Issue:** Reserved peers are never evicted even if permanently unreachable (score < 0, offline for hours). They block peer slots needed for honest peers.  
**Fix:** Evict reserved peers if unreachable for >1 hour and score < -5.

### H15. RPC WebSocket Message Flood
**File:** [rpc/src/ws.rs](../rpc/src/ws.rs) ~L650-680  
**Issue:** WS message size limit (1MB) exists but no per-connection message rate limit. Client can send 1000 × 1MB messages per second → 1GB/s sustained attack per connection.  
**Fix:** Add per-connection message rate limiter (max 100 msg/sec).

### H16. RPC Shielded Commitment Enumeration
**File:** [rpc/src/shielded.rs](../rpc/src/shielded.rs) ~L180-220  
**Issue:** `GET /api/v1/shielded/commitments?from=0&limit=1000` exposes ALL commitment indices sequentially. Attacker can correlate deposits to unshield transactions by monitoring merkle-proof requests. Breaks privacy.  
**Fix:** Return only recent N commitments without sequential `from` parameter.

### H17. Faucet Rate Limiter Unbounded HashMap
**File:** [faucet/src/main.rs](../faucet/src/main.rs) ~L100-151  
**Issue:** `ip_usage` HashMap grows unbounded. Cleanup only runs on next request. Slow DoS from 10K IPs creates permanent memory bloat.  
**Fix:** Scheduled cleanup every 10 minutes, independent of request flow.

### H18. Contract Storage Hard Limit (10K entries) Creates Silent Failures
**File:** [core/src/contract.rs](../core/src/contract.rs) ~L2237-2241  
**Issue:** Once a contract reaches 10,000 storage entries, `storage_write` silently returns 0. Contract code may not check the return value. Governance DAO with 15K proposals becomes unusable without error.  
**Fix:** Increase to 100K+ or make configurable. Return explicit error code rather than silent 0.

---

## MEDIUM FINDINGS

### M1. Snapshot Export Cursor Memory Leak
**File:** [validator/src/main.rs](../validator/src/main.rs) ~L8680-8750  
**Issue:** `snapshot_export_cursors` HashMap pruned only at 1000 entries. Stale cursors accumulate from disconnected peers.  
**Fix:** Time-based eviction (30-min inactivity).

### M2. Stale Validator Cleanup Removes Bootstrap Validators
**File:** [validator/src/main.rs](../validator/src/main.rs) ~L10050-10100  
**Issue:** Validators with `blocks_proposed == 0` AND old `last_active_slot` get removed. New bootstrap validators that voted but didn't produce blocks get pruned prematurely.  
**Fix:** Also check `joined_slot < stale_cutoff`.

### M3. EVM Balance Overflow Silently Dropped
**File:** [core/src/evm.rs](../core/src/evm.rs) ~L622-633  
**Issue:** When EVM contract balance > u64::MAX spores, conversion fails and `native_balance_update` is set to `None`, silently dropping the balance update. EVM state modified without native balance sync.  
**Fix:** Return error from `execute_evm_transaction()`, reject the TX entirely.

### M4. JSON Arg Encoding Heuristic Unsafe
**File:** [core/src/contract.rs](../core/src/contract.rs) ~L2325-2330  
**Issue:** Auto-detects JSON by checking `args[0] == b'['`. Binary args starting with 0x5B are misinterpreted as JSON.  
**Fix:** Require explicit format discriminator (e.g., 0xAB prefix for binary layout).

### M5. Message::serialize() Panics
**File:** [core/src/transaction.rs](../core/src/transaction.rs) ~L95-99  
**Issue:** `serialize()` panics on bincode error instead of returning `Result`. In consensus-critical paths, this crashes the validator.  
**Fix:** Return `Result<Vec<u8>, String>`.

### M6. Custody Reserve Ledger Global Mutex Bottleneck
**File:** [custody/src/main.rs](../custody/src/main.rs) ~L6496-6500  
**Issue:** Single global mutex for ALL reserve updates. Under high throughput, all sweep/withdrawal/rebalance jobs serialize.  
**Fix:** Per-chain locks or fine-grained RwLock.

### M7. Custody Signer Auth Token Generated-and-Lost
**File:** [custody/src/main.rs](../custody/src/main.rs) ~L1032-1040  
**Issue:** If `CUSTODY_SIGNER_AUTH_TOKEN` env var not set with signers configured, a random token is generated but never exposed to operators.  
**Fix:** Panic if signers configured without auth token, or log the generated token.

### M8. Custody Rebalance Swap Unverified Output Loses Funds
**File:** [custody/src/main.rs](../custody/src/main.rs) ~L5948-5975  
**Issue:** When parsing rebalance swap output fails, job goes to `"unverified"` status with no credit. Swap executed on-chain but custody never records it.  
**Fix:** Mark as `requires_manual_audit` with operator alert, or fall back to direct balance check.

### M9. Faucet Airdrops Synchronous File Write
**File:** [faucet/src/main.rs](../faucet/src/main.rs) ~L413-422  
**Issue:** Every airdrop re-serializes entire history (up to 10K records) and writes synchronously to disk. Under load, blocking I/O becomes bottleneck.  
**Fix:** Use async write or append-only log.

### M10. RPC DEX Orderbook Depth Not Capped
**File:** [rpc/src/dex.rs](../rpc/src/dex.rs) ~L1200-1250  
**Issue:** `depth` parameter not validated. Request with `depth=u64::MAX` forces processing of entire orderbook.  
**Fix:** `const MAX_DEPTH: usize = 1000; let depth = q.depth.unwrap_or(20).min(MAX_DEPTH);`

### M11. RPC Shielded Merkle Rebuild O(n) Per Request
**File:** [rpc/src/shielded.rs](../rpc/src/shielded.rs) ~L140-180  
**Issue:** Each merkle-path request rebuilds the ENTIRE tree from all commitments. O(n log n) per request.  
**Fix:** Cache the merkle tree in memory (append-only, reuse previous tree).

### M12. P2P BlockRangeResponse Not Capped
**File:** [p2p/src/network.rs](../p2p/src/network.rs) ~L483-498  
**Issue:** Request caps at 500 blocks, but response is uncapped. Peer can send 10K blocks in one response.  
**Fix:** `if blocks.len() > 500 { record_violation; return; }`

### M13. P2P ErasureShard Request Amplification
**File:** [p2p/src/network.rs](../p2p/src/network.rs) ~L788-805  
**Issue:** No limit on `shard_indices.len()` in `ErasureShardRequest`. Peer can request 10K shards at once.  
**Fix:** `const MAX_SHARD_INDICES_PER_REQUEST: usize = 10;`

### M14. Genesis Fee Percentages Can Sum < 100
**File:** [core/src/genesis.rs](../core/src/genesis.rs) ~L216-225  
**Issue:** Validation allows fee percentages to sum to less than 100%. Unallocated fees have undefined behavior.  
**Fix:** Require `total_pct == 100` exactly, or document burn behavior for remainder.

### M15. TOFU Fingerprint Store Blocks Legitimate Key Rotation
**File:** [p2p/src/peer.rs](../p2p/src/peer.rs) ~L1399-1420  
**Issue:** If a validator rotates its certificate after a security incident, old fingerprint in TOFU store permanently blocks reconnection. No manual override mechanism.  
**Fix:** Add admin flag `--reset-peer-fingerprints <addr>` or time-based re-registration (after 30 days, allow re-registration).

---

## LOW FINDINGS

### L1. `Block::new()` Uses Wall Clock
Already identified in previous audits. Not used in production (validator uses `Block::new_with_timestamp()`). Consider `#[cfg(test)]`-gating `Block::new()`.

### L2. Annual Reward Decay Loop Caps at 50 Years
`consensus.rs` ~L108-118 — loop stops at 50 iterations. If chain runs >50 years, reward stops decaying. Use geometric formula instead.

### L3. Uptime Returns 100% When slots_active == 0
`consensus.rs` ~L1066-1080 — edge case returns 10000 bps (100%) uptime. Should return 0 or error.

### L4. DEX Price Floating-Point Precision Loss
`rpc/src/dex.rs` ~L1400-1450 — u64 prices converted to f64, losing ~6 digits precision at high prices. Return prices as strings or raw integers.

### L5. WebSocket Subscription ID u64 Overflow
`rpc/src/ws.rs` ~L1080-1120 — IDs increment without reset. After 2^64 subscriptions, ID wraps and could collide with active subscriptions. Use randomized IDs.

### L6. Faucet CORS Origins Hardcoded
`faucet/src/main.rs` ~L289-308 — requires recompile to add new frontend domain. Load from env var.

### L7. Faucet Status Endpoint No Rate Limit
Public endpoint exposes real-time balance. Attacker can time draining attacks. Add basic rate limiting.

### L8. Contract Module Cache Contention
`core/src/contract.rs` ~L2086 — single Mutex for WASM module LRU cache. Under high contract call rate, becomes contention point. Consider sharded cache.

---

## Summary & Priority Matrix

### Immediate (Before Adding More Validators)
1. **C1** — Leader election race condition
2. **C2** — Gossip dedup timestamp issue
3. **C6** — P2P rate limiting on snapshots
4. **H2** — Watchdog false-positive during sync
5. **H3** — Deadlock breaker fork risk

### Before Public Mainnet
6. **C3** — CompactBlock oracle price authentication
7. **C4** — Custody burn verification hang
8. **C7** — RPC prediction market full scan
9. **C8** — Launchpad equity overflow
10. **H1** — Compact block short-ID verification
11. **H4** — Vote before effects verified
12. **H5** — Custody key zeroization
13. **H18** — Contract 10K storage limit

### Before Custody Goes Live
14. **C5** — FROST multi-signer not wired
15. **H6** — Burn amount verification
16. **M6** — Reserve ledger mutex
17. **M7** — Signer auth token UX
18. **M8** — Rebalance swap output parsing

### Ongoing Hardening
19-49. All remaining HIGH/MEDIUM/LOW findings

---

## Notes

- Several findings from previous audits (CORE_AUDIT_REPORT.md, CORE_PRODUCTION_READINESS_AUDIT.md) were cross-referenced. Items already flagged there are noted.
- The parallel transaction processing (Sealevel-style) was verified as safe — `CONTRACT_PROGRAM_ID` exclusion from conflict detection is correct because `ix.accounts` still includes the actual contract address.
- Slashing percentages ARE loaded from consensus params (not hardcoded). Previous audit finding was a false positive.
- `Block::new()` with wall-clock timestamp exists but is NOT used by the validator in production.
