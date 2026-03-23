# Lichen Blockchain Standards Audit Plan

> Repo-wide credibility and standards audit for the post-v0.4.5 codebase.
> This document starts a new workstream after the original alignment plan was closed.

**Created:** 2026-03-19
**Status:** DRAFT — audit started, remediation planning in progress
**Goal:** identify protocol, runtime, contract, RPC, storage, oracle, bridge, and operational gaps that would make experienced blockchain engineers question Lichen's seriousness.

Related follow-on documents:

- [BLOCKCHAIN_PUBLIC_CLAIM_CORRECTIONS.md](./BLOCKCHAIN_PUBLIC_CLAIM_CORRECTIONS.md)
- [CUSTODY_ORACLE_TRUST_MODEL.md](./CUSTODY_ORACLE_TRUST_MODEL.md)
- [CONTRACT_PLATFORM_UNIFICATION_PLAN.md](./CONTRACT_PLATFORM_UNIFICATION_PLAN.md)
- [BLOCKCHAIN_HARDENING_BACKLOG.md](./BLOCKCHAIN_HARDENING_BACKLOG.md)

## Execution Log

### Closed Task 1 — Authenticated Validator-Set Commitment

**Status:** CLOSED

**Outcome:** `validators_hash` is now part of the signed block header domain rather than unsigned metadata.

**Code:** [core/src/block.rs](../../core/src/block.rs)

**Validation:**

- `cargo test -p lichen-core --lib block::tests::test_block_signature_covers_validators_hash -- --exact`

### Closed Task 2 — Canonical Oracle Unification Onto Native Consensus Oracle

**Status:** CLOSED

**Outcome:** canonical user-facing oracle reads now use the validator-attested native consensus oracle rather than LichenOracle contract storage.

**Code:**

- [core/src/consensus.rs](../../core/src/consensus.rs)
- [rpc/src/lib.rs](../../rpc/src/lib.rs)
- [rpc/src/dex.rs](../../rpc/src/dex.rs)
- [rpc/tests/rpc_full_coverage.rs](../../rpc/tests/rpc_full_coverage.rs)

**Validation:**

- `cargo check -p lichen-rpc`
- `cargo test -p lichen-core --lib consensus::tests::test_consensus_oracle_price_from_state_reads_native_price -- --exact`
- `cargo test -p lichen-core --lib consensus::tests::test_licn_price_from_state_falls_back_when_consensus_price_is_stale -- --exact`
- `cargo test -p lichen-rpc --test rpc_full_coverage test_rest_dex_oracle_prices -- --exact`
- `cargo test -p lichen-rpc --test rpc_full_coverage test_native_get_oracle_prices_uses_consensus_oracle -- --exact`

### Closed Task 3 — BFT Finality Commitment Alignment

**Status:** CLOSED

**Outcome:** finalized commitment now aligns with actual BFT supermajority commits instead of an artificial 32-slot delay; persisted finalized state is normalized on startup, and WebSocket signature status now uses the same shared finality tracker as JSON-RPC.

**Code:**

- [core/src/consensus.rs](../../core/src/consensus.rs)
- [core/src/state.rs](../../core/src/state.rs)
- [rpc/src/ws.rs](../../rpc/src/ws.rs)
- [validator/src/main.rs](../../validator/src/main.rs)

**Validation:**

- `cargo test -p lichen-core --lib consensus::tests::test_finality_tracker_finalizes_on_confirmation -- --exact`
- `cargo test -p lichen-core --lib consensus::tests::test_finality_tracker_normalizes_legacy_persisted_finalized_slot -- --exact`
- `cargo test -p lichen-rpc --lib ws::tests::signature_commitment_status_uses_finality_tracker -- --exact`
- `cargo test -p lichen-rpc --lib ws::tests::signature_commitment_status_without_finality_tracker_falls_back -- --exact`

### Closed Task 4 — Native Anchored Account Proofs

**Status:** CLOSED

**Outcome:** `getAccountProof` now returns a strict native anchored proof format and rejects proofs whose Merkle root cannot be bound to the block at the requested commitment slot. The proof surface no longer exposes an unauthenticated bare `state_root` response shape.

**Code:**

- [rpc/src/lib.rs](../../rpc/src/lib.rs)
- [rpc/tests/rpc_full_coverage.rs](../../rpc/tests/rpc_full_coverage.rs)

**Validation:**

- `cargo test -p lichen-rpc --test rpc_full_coverage test_native_get_account_proof_returns_anchored_finalized_context -- --exact`
- `cargo test -p lichen-rpc --test rpc_full_coverage test_native_get_account_proof_rejects_unanchored_state_root -- --exact`
- `cargo check -p lichen-rpc`

### Closed Task 5 — Self-Contained Commit Certificate Verification

**Status:** CLOSED

**Outcome:** committed blocks now persist their `commit_round`, commit verification uses that recorded round exactly instead of guessing, live block validation no longer accepts invalid commit certificates, and RPC proof/block surfaces expose the recorded round for independent verification.

**Code:**

- [core/src/block.rs](../../core/src/block.rs)
- [p2p/src/message.rs](../../p2p/src/message.rs)
- [validator/src/consensus.rs](../../validator/src/consensus.rs)
- [validator/src/main.rs](../../validator/src/main.rs)
- [rpc/src/lib.rs](../../rpc/src/lib.rs)
- [rpc/tests/rpc_full_coverage.rs](../../rpc/tests/rpc_full_coverage.rs)

**Validation:**

- `cargo test -p lichen-core --lib block::tests::test_verify_commit_valid_supermajority -- --exact`
- `cargo test -p lichen-core --lib block::tests::test_verify_commit_wrong_round_fails -- --exact`
- `cargo test -p lichen-rpc --test rpc_full_coverage test_native_get_account_proof_returns_anchored_finalized_context -- --exact`
- `cargo test -p lichen-rpc --test rpc_full_coverage test_native_get_block_commit_exposes_commit_round -- --exact`
- `cargo check -p lichen-core -p lichen-p2p -p lichen-rpc -p lichen-validator`

### Closed Task 6 — Verified Finalized Checkpoint Snapshot Serving

**Status:** CLOSED

**Outcome:** checkpoint metadata and state snapshot serving now expose only checkpoints backed by a finalized block whose state root matches the checkpoint and whose commit certificate verifies exactly. The validator no longer falls back to serving live state when no verified finalized checkpoint exists.

**Code:**

- [validator/src/main.rs](../../validator/src/main.rs)

**Validation:**

- `cargo test -p lichen-validator latest_verified_checkpoint_requires_finalized_committed_block -- --nocapture`
- `cargo check -p lichen-validator`

### Closed Task 7 — Authenticated Checkpoint Metadata On Warp Sync

**Status:** CLOSED

**Outcome:** checkpoint metadata responses now carry a signed block header plus commit certificate, and the snapshot consumer refuses to request or import state chunks unless that checkpoint anchor verifies against the local validator set and stake pool. Snapshot chunks are additionally bound to the verified `(slot, state_root)` advertised by the peer.

**Code:**

- [p2p/src/message.rs](../../p2p/src/message.rs)
- [p2p/src/network.rs](../../p2p/src/network.rs)
- [validator/src/main.rs](../../validator/src/main.rs)

**Validation:**

- `cargo test -p lichen-validator latest_verified_checkpoint_requires_finalized_committed_block -- --nocapture`
- `cargo test -p lichen-validator verify_checkpoint_anchor_requires_signed_committed_header -- --nocapture`
- `cargo check -p lichen-p2p -p lichen-validator`

### Closed Task 8 — Atomic Canonical Block Persistence

**Status:** CLOSED

**Outcome:** canonical block persistence now commits block data, `last_slot`, and any known confirmed/finalized slot metadata through one RocksDB `WriteBatch`. Validator canonical apply paths no longer advance the tip through a second follow-up write, and the BFT commit path persists its commitment metadata in the same durable write as the block itself.

**Code:**

- [core/src/state.rs](../../core/src/state.rs)
- [validator/src/main.rs](../../validator/src/main.rs)

**Validation:**

- `cargo test -p lichen-core test_put_block_atomic_persists_slot_and_finality_metadata -- --nocapture`
- `cargo check -p lichen-validator`

### Closed Task 9 — Public RPC Control-Plane Hardening

**Status:** CLOSED

**Outcome:** legacy bearer-token admin mutation RPCs are now hard-disabled outside local/dev environments. Public-style networks can no longer use `setFeeConfig`, `setRentParams`, `setContractAbi`, `deployContract`, or `upgradeContract` as an out-of-band control plane, even if an admin token is configured.

**Code:**

- [rpc/src/lib.rs](../../rpc/src/lib.rs)
- [rpc/tests/rpc_full_coverage.rs](../../rpc/tests/rpc_full_coverage.rs)

**Validation:**

- `cargo test -p lichen-rpc --test rpc_full_coverage test_native_legacy_admin_rpcs_disabled_on_public_networks -- --exact`
- `cargo check -p lichen-rpc`

### Closed Task 10 — Deterministic Genesis Inputs And Replay

**Status:** CLOSED

**Outcome:** genesis creation no longer performs live HTTP price fetches, wall-clock timestamping, faucet key generation, or random founding-validator generation during block-zero creation. The `lichen-genesis` create path now consumes explicit wallet artifacts, requires explicit initial validator identities, writes deterministic slot-0 validator registrations into the genesis block, and replays fixed oracle/analytics/margin seed data from the stored genesis timestamp.

**Code:**

- [genesis/src/main.rs](../../genesis/src/main.rs)
- [genesis/src/lib.rs](../../genesis/src/lib.rs)
- [core/src/genesis.rs](../../core/src/genesis.rs)
- [validator/src/main.rs](../../validator/src/main.rs)

**Validation:**

- `cargo check -p lichen-genesis -p lichen-validator -p lichen-core`
- `cargo test -p lichen-core --lib genesis::tests::test_default_genesis_time_is_deterministic -- --exact`
- `cargo test -p lichen-genesis --lib tests::test_genesis_pair_prices_are_deterministic -- --exact`

### Closed Task 11 — Oracle Authority Unification

**Status:** CLOSED

**Outcome:** validator runtime price ingestion now flows through signed native oracle-attestation transactions rather than proposer-carried Binance snapshots, startup explicitly seeds bootstrap consensus prices, and post-block DEX/analytics compatibility writes now mirror finalized native consensus-oracle state instead of treating `block.oracle_prices` or direct feeder storage as authoritative truth.

**Code:**

- [validator/src/main.rs](../../validator/src/main.rs)

**Validation:**

- `cargo check -p lichen-validator`
- `cargo test -p lichen-validator tests::apply_oracle_from_block_uses_consensus_prices_not_block_payload -- --exact`
- `cargo test -p lichen-validator tests::build_oracle_attestation_tx_encodes_native_instruction -- --exact`

### Closed Task 12 — Canonical Contract Storage Unification

**Status:** CLOSED

**Outcome:** contract execution, dry-run simulation, and cross-contract calls now source live state from `CF_CONTRACT_STORAGE` rather than serialized `ContractAccount.storage`. Runtime storage writes persist only to the external contract storage backend, and embedded contract JSON no longer acts as a second mutable authority for live contract state.

**Code:**

- [core/src/state.rs](../../core/src/state.rs)
- [core/src/contract.rs](../../core/src/contract.rs)
- [core/src/processor.rs](../../core/src/processor.rs)
- [core/tests/cross_contract_call.rs](../../core/tests/cross_contract_call.rs)

**Validation:**

- `cargo check -p lichen-core`
- `cargo test -p lichen-core test_prepare_execution_context_preserves_live_storage -- --nocapture`
- `cargo test -p lichen-core --test cross_contract_call -- --nocapture`

### Closed Task 13 — Finality Public Claim Alignment

**Status:** CLOSED

**Outcome:** active developer-facing finality docs now match the runtime commitment model. WebSocket and SDK docs distinguish canonical transaction-stream events from per-signature commitment tracking, and public status copy now states that `finalized` is driven by the BFT finality tracker rather than any extra depth rule. Residual stale copy in the Programs footer and WebSocket reference has also been scrubbed to remove `instant finality` / `32-slot delay` language.

**Code / docs:**

- [core/src/consensus.rs](../../core/src/consensus.rs)
- [rpc/src/ws.rs](../../rpc/src/ws.rs)
- [developers/ws-reference.html](../../developers/ws-reference.html)
- [programs/index.html](../../programs/index.html)
- [developers/sdk-js.html](../../developers/sdk-js.html)
- [developers/sdk-python.html](../../developers/sdk-python.html)
- [docs/strategy/BLOCKCHAIN_ALIGNMENT_PLAN.md](./BLOCKCHAIN_ALIGNMENT_PLAN.md)

**Validation:**

- `cargo test -p lichen-rpc --lib ws::tests::signature_commitment_status_uses_finality_tracker -- --exact`

---

## Why A New Audit Exists

The original [BLOCKCHAIN_ALIGNMENT_PLAN.md](./BLOCKCHAIN_ALIGNMENT_PLAN.md) closed a large amount of foundational work. That plan materially improved the chain.

This follow-up audit exists for a different reason: **credibility hardening**.

The repo is now strong enough that the biggest remaining risks are not generic bugs. They are places where:

- protocol claims are stronger than what the code can currently prove,
- trust boundaries are still transitional,
- core execution models are internally inconsistent,
- or operations still look like an advanced prototype rather than a hardened public L1.

That is the layer that outside reviewers, exchange engineers, infra teams, protocol researchers, and serious users will judge most harshly.

## Direction Locked

The goal of this workstream is not to weaken public claims. It is to make the strongest public claims true in code and in live production behavior.

Decisions for the audit:

- **Oracle:** the canonical user-facing oracle must converge to the native validator-attested consensus oracle. The LichenOracle contract remains an application-layer contract for feeds, attestations, VRF, and domain-specific composition, but it should not remain the long-term canonical price authority for chain-wide trust claims.
- **Custody:** threshold signing should be completed, tested end-to-end, and promoted to the real production path. Public custody claims should be earned in code rather than diluted in marketing.

Why these directions match blockchain standards:

- serious L1s anchor canonical price/truth paths in validator or protocol consensus when those prices affect core trust claims,
- application contracts can consume or extend protocol data, but should not be mistaken for the consensus truth source,
- threshold-signing custody claims are only credible when the threshold path is the actual production signing path rather than a side implementation,
- strong public claims should be backed by the same code paths operators actually run.

---

## Audit Scope

This audit is focused on standards alignment relative to serious L1 expectations, not feature brainstorming.

Primary scope:

- `core/`
- `validator/`
- `rpc/`
- `p2p/`
- `genesis/`
- `contracts/`
- `compiler/`
- `sdk/`
- custody / oracle / deployment trust boundaries

Reference standards used implicitly in this audit:

- CometBFT / Tendermint style BFT safety and evidence
- Ethereum / beacon-chain style signed header integrity and light-client proofs
- Solana / SVM style transaction and program model clarity
- CosmWasm / NEAR style contract ABI, result semantics, and deterministic genesis discipline
- mature open-source blockchain operational expectations around custody, secrets, governance, and public claims

---

## Executive Summary

Lichen is no longer a toy codebase. The core architecture now contains real BFT machinery, commit evidence, validator lifecycle work, state-proof primitives, and a growing contract platform.

The remaining credibility risks cluster in five areas:

1. **Authenticated sync and signed consensus boundaries are still weaker than the public BFT / light-client story implies.**
2. **Finality and proof claims are stronger than the implementation currently guarantees.**
3. **The contract platform does not yet expose one coherent execution, ABI, and storage model.**
4. **Bridge custody and admin mutation paths still rely on transitional trust assumptions.**
5. **Operational transparency and repo hygiene still mix public-chain posture with private or local-only processes.**

If these remain unresolved, the project risks being seen as technically ambitious but architecturally uneven.

---

## Findings Summary

| ID | Severity | Area | Finding |
|---|---|---|---|
| C-1 | CRITICAL | Consensus | `validators_hash` is present in headers but not covered by the signed block hash |
| C-2 | CRITICAL | Sync | Initial sync and warp sync still trust peer-provided data too much |
| C-3 | CRITICAL | Contracts | Cross-contract dispatch is inconsistent and appears structurally broken in key protocol flows |
| H-1 | HIGH | Consensus | Commit certificates are not self-contained enough for exact independent verification |
| H-2 | HIGH | Finality | Public BFT/finality claims still do not match the commitment model exposed in code and RPC |
| H-3 | HIGH | State Proofs | Current account proofs are useful but over-claimed relative to production authenticated-state standards |
| H-4 | HIGH | Genesis | Genesis creation is still privileged and not cleanly reproducible from fully deterministic artifacts |
| H-5 | HIGH | Contracts | Contract state is split between serialized account storage and a separate storage backend |
| H-6 | HIGH | Custody | Threshold / multisig custody claims exceed the production-ready implementation |
| M-1 | MEDIUM | Storage | So-called atomic block commit still spans multiple writes |
| M-2 | MEDIUM | RPC/Admin | Bearer-token admin mutation RPCs remain a non-standard control plane |
| M-3 | MEDIUM | P2P | Discovery improved, but dissemination still behaves mostly like flat broadcast |
| M-4 | MEDIUM | Security Ops | Secrets, deployment status, and some critical docs still live in local-only or ignored paths |

---

## Detailed Findings

### C-1. Unsigned Validator-Set Commitment

**Severity:** CRITICAL

**Problem**

The chain now carries `validators_hash` in the block header, but the signable block hash still excludes it. That means the field exists as metadata without full signature-domain protection.

**Why this matters**

A validator-set commitment that is not fully signed does not give light clients or auditors the property it claims to provide.

**Primary files**

- `core/src/block.rs`
- `validator/src/main.rs`

**Required direction**

- include `validators_hash` in the canonical signed header domain,
- version-gate legacy blocks if necessary,
- expose the signed commitment consistently through RPC.

### C-2. Sync Trust Boundary Still Too Soft

**Severity:** CRITICAL

**Problem**

Initial sync, header-only sync, and warp-sync paths still accept or self-consistency-check peer-provided data in places where a serious L1 should require authenticated commit evidence.

**Why this matters**

This is one of the fastest ways to lose credibility with protocol engineers: a joining node should not need to trust arbitrary peers more than the protocol itself.

**Primary files**

- `validator/src/sync.rs`
- `validator/src/main.rs`

**Required direction**

- require verified commit certificates before state application,
- anchor warp sync to trusted finalized headers,
- remove warning-only verification failures in authenticated paths.

**Progress so far**

- committed blocks received during sync/P2P no longer treat nonzero `validators_hash` mismatches as warning-only drift; the validator now rejects those blocks as authenticated state-divergence candidates instead of continuing past a conflicting validator-set commitment.
- warp sync no longer starts snapshot downloads from the first peer that returns a verified checkpoint header; snapshot transfer now waits for corroboration from a second peer advertising the same `(slot, state_root)` anchor before pinning the download to that checkpoint.

This materially hardens the authenticated sync boundary, but it does **not** yet fully close `C-2`: initial sequential catch-up is still not a complete light-client-grade sync model, and warp-sync peer selection still needs stronger retry and quorum semantics beyond the first corroborated anchor.

**Focused validation completed**

- `cargo test -p lichen-validator tests::verify_block_validators_hash_rejects_mismatch -- --exact`
- `cargo test -p lichen-validator tests::checkpoint_anchor_support_counts_matching_peers -- --exact`
- `cargo test -p lichen-validator tests::verify_checkpoint_anchor_requires_signed_committed_header -- --exact`

### C-3. Contract Call Surface Is Not One Coherent Platform

**Severity:** CRITICAL

**Status:** IN PROGRESS

**Problem**

The runtime mixes named-export dispatch, opcode dispatch, partial ABI discovery, and ad hoc cross-contract call expectations. Several contracts appear to call exports that do not exist.

**Progress so far**

- the runtime now falls back from missing named exports to ABI-declared opcode dispatch through `call()` when selector metadata exists,
- zero-address native account operations used by margin flows are now handled coherently by the runtime and processor,
- DEX cross-contract calls that were manually embedding opcode bytes have been normalized onto logical function names plus ABI metadata,
- the router/core CLOB mismatch has been reduced by adding a canonical exact-input `swap_exact_in` surface in `dex_core` and routing `dex_router` through that function instead of a non-existent `place_order_market` export.
- the router AMM leg now invokes the logical `swap_exact_in` surface with ABI layout metadata instead of manually targeting raw `call()` opcode dispatch.
- the `dex_core` sell-side token balance check now calls named-export token functions with the correct raw account bytes instead of prepending an opcode byte that corrupted `balance_of` arguments for named-export token contracts.
- the `sporepump` graduation threshold path no longer emits malformed `create_pair` / `create_pool` / `add_liquidity` cross-contract calls with ABI-incompatible argument shapes; until a real asset-and-pool migration surface exists, threshold crossings stay on the bonding curve instead of falsely claiming DEX graduation.
- `dex_governance` proposal execution no longer treats failed downstream `create_pair` / `update_pair_fees` / `pause_pair` calls as executed work; those proposals now remain in the passed state with explicit failure logs until the cross-contract application succeeds.
- `thalllend` no longer queries `lichenoracle` with borrower bytes through the out-buffer `get_price` export; oracle-backed collateral valuation now uses a configured feed key plus a cross-contract-safe `get_price_value` return-data export.
- `dex_router` no longer exposes any legacy LichenSwap route surface; routing is now limited to the supported `dex_core` and `dex_amm` call models instead of carrying an unused third ABI family.
- `sporevault` no longer cross-calls non-existent `lichenswap.get_lp_rewards` exports during harvest, and its lending strategy now queries a real `thalllend.get_accrued_interest` yield-quote export instead of depending on an unwired protocol interface.
- `prediction_market` no longer cross-calls a non-existent `lichenoracle.get_attestation` export during resolution submission; oracle-gated resolution now targets the real `lichenoracle.get_attestation_data` surface and has a regression that locks the dispatched function name.
- the SDK's token/NFT cross-contract helpers no longer assume a single `1 == success` return-code convention; they now accept the repo's live LE-encoded `0`-success and `1`-success transfer surfaces, which removes a real caller/runtime mismatch for `lichencoin` versus wrapped-token and NFT contracts.

This materially reduces the broken-call-surface risk in live protocol flows, but it does **not** yet close the broader platform finding because Lichen still exposes multiple ABI families and does not yet have one final public contract model.

**Why this matters**

An open L1 contract platform must define one credible external call model. If not, the ecosystem looks improvised, and high-value contract families become hard to trust.

**Primary files**

- `core/src/contract.rs`
- `contracts/dex_core/src/lib.rs`
- `contracts/dex_governance/src/lib.rs`
- `contracts/dex_router/src/lib.rs`
- `contracts/dex_margin/src/lib.rs`

**Required direction**

- choose one canonical invocation model,
- standardize result envelopes and errors,
- align SDK codegen and runtime dispatch to the same contract ABI story.

**Focused validation completed**

- `cargo check -p lichen-core`
- `cargo test -p lichen-core test_contract_abi_parses_repo_json_shape`
- `cargo test -p lichen-core test_build_opcode_dispatch_args_prefixes_selector`
- `cd contracts/dex_core && cargo test swap_exact_in`
- `cd contracts/dex_core && cargo test balance_check_passes_named_export_account_bytes`
- `cd contracts/dex_core && cargo test place_limit_sell`
- `cd contracts/sporepump && cargo test threshold_crossing`
- `cd contracts/sporepump && cargo test g24_threshold_without_dex_keeps_curve_active`
- `cd contracts/dex_governance && cargo test execute_new_pair`
- `cd contracts/dex_governance && cargo test execute_fee_change`
- `cd contracts/lichenoracle && cargo test get_price_value`
- `cd contracts/thalllend && cargo test get_oracle_price_uses_configured_feed_surface`
- `cd contracts/thalllend && cargo test get_accrued_interest_returns_current_quote -- --exact`
- `cd contracts/dex_router && cargo test swap`
- `cd contracts/sporevault && cargo test test_query_protocol_yield_test_mode -- --exact`
- `cd contracts/sporevault && cargo test test_harvest_with_protocol_addresses_configured -- --exact`
- `cd contracts/prediction_market && cargo test submit_resolution_with_oracle_rejects_in_mock`
- `cd contracts/dex_router && cargo test test_build_amm_swap_exact_in_args_layout -- --exact`
- `cd sdk && cargo test crosscall::tests::test_decode_success_status_accepts_zero_and_one_codes -- --exact`
- `cd sdk && cargo test crosscall::tests::test_call_token_transfer_accepts_lichencoin_zero_code -- --exact`
- `cd sdk && cargo test crosscall::tests::test_call_nft_transfer_accepts_one_code -- --exact`

### H-1. Commit Certificates Need Exact Verification Semantics

**Severity:** HIGH

**Problem**

Commit verification still depends on guessed or external round context rather than self-contained block evidence.

**Why this matters**

Independent verification should be exact. Guessing rounds is not standards-grade BFT evidence handling.

**Required direction**

- persist commit round in committed metadata,
- expose it via RPC,
- make verifier logic strict rather than heuristic.

### H-2. Finality Story Still Overstates What The Implementation Means

**Severity:** HIGH

**Status:** CLOSED by Task 13

**Problem**

The repo still mixes BFT-final messaging with a processed / confirmed / finalized model that includes a 32-slot depth layer.

**Why this matters**

Outside users will treat this as either imprecision or marketing drift unless the model is simplified or described honestly.

**Required direction**

- either adopt a cleaner BFT-final semantics model,
- or update README, SDK docs, RPC docs, and product claims to match the actual commitment model.

**Closure note**

Active developer-facing docs now distinguish generic transaction-stream events from explicit signature commitment tracking, and public copy states that `finalized` is driven by the BFT finality tracker rather than an extra depth delay.

### H-3. State Proofs Exist But Are Over-Claimed

**Severity:** HIGH

**Status:** CLOSED

**Problem**

Current account proofs are closer to ordered-current-state inclusion proofs than to a mature authenticated-state scheme with strong existence and non-existence semantics.

**Why this matters**

Light-client and proof claims are judged by exact proof properties, not by rough equivalence.

**Required direction**

- either narrow the public claim,
- or complete the move to a production authenticated-state structure with height-anchored proofs.

**Closure note**

The live RPC proof surface already returns anchored account inclusion proofs rather than an unauthenticated bare `state_root` shape, and active public docs now describe it that way. Public claim surfaces no longer imply non-existence proofs, SMT-grade authenticated state, or full light-client completeness from the current account-proof implementation.

**Validation**

- `cargo test -p lichen-rpc --test rpc_full_coverage test_native_get_account_proof_returns_anchored_finalized_context -- --exact`
- `cargo test -p lichen-rpc --test rpc_full_coverage test_native_get_account_proof_rejects_unanchored_state_root -- --exact`

### H-4. Genesis Still Does Too Much Privileged, Live-Time Work

**Severity:** HIGH

**Status:** CLOSED

**Problem**

Genesis still depends on live HTTP data, wall-clock conditions, and direct privileged contract-state mutation.

**Why this matters**

Serious L1 genesis should be reproducible from versioned inputs, not partly assembled from live side effects.

**Primary files**

- `genesis/src/main.rs`
- `genesis/src/lib.rs`

**Required direction**

- eliminate live network I/O from genesis,
- freeze manifests and inputs,
- restrict privileged initialization to explicit, auditable genesis-only hooks.

**Closure note**

Genesis creation already moved onto explicit wallet artifacts, deterministic validator inputs, and fixed bootstrap price data. The remaining live-time leak in LichenID genesis cross-attestation timestamps now uses the configured genesis block timestamp during both fresh creation and sync replay, so genesis initialization no longer depends on wall-clock time.

**Validation**

- `cargo check -p lichen-genesis -p lichen-validator`

### H-5. Contract Storage Has Two Sources Of Truth

**Severity:** HIGH

**Status:** CLOSED

**Outcome**

The runtime and processor no longer rely on both serialized `ContractAccount` storage and a separate contract-storage backend as live authorities. Execution contexts are now built from `CF_CONTRACT_STORAGE`, cross-contract calls inherit the same canonical storage source, and runtime mutations persist only to the external storage backend.

**Why this matters**

Dual-authority storage models are fragile, hard to audit, and likely to drift. Closing H-5 removes that split-brain risk from contract execution.

**Validation**

- `cargo check -p lichen-core`
- `cargo test -p lichen-core test_prepare_execution_context_preserves_live_storage -- --nocapture`
- `cargo test -p lichen-core --test cross_contract_call -- --nocapture`

### H-6. Custody Trust Model Is Over-Claimed

**Severity:** HIGH

**Status:** IN PROGRESS

**Problem**

The public posture still implies threshold / multisig custody readiness, while the production path still depends on unsafe or effectively centralized assumptions.

**Why this matters**

Bridge and custody trust models are among the first external credibility tests any chain fails or passes.

**Required direction**

- either downgrade all public claims immediately,
- or complete the threshold signing architecture and remove unsafe production overrides.

**Progress so far**

- native Solana treasury withdrawals with `>1` signer endpoints no longer fall through the generic single-round `/sign` path; the withdrawal worker now routes those spends through the existing two-round FROST commit/sign coordinator and reuses the same aggregated-signature assembly path already present in custody.
- multi-signer startup no longer hides behind a global unsafe override gate. The service now starts in multi-signer mode, advertises the exact support boundary, and fail-closes unsupported threshold routes instead of implying that every chain has one production-ready threshold path.
- EVM threshold withdrawals no longer stop at a fake raw-transaction blob. The coordinator now fetches the Safe nonce and Safe transaction hash via `eth_call`, collects owner signatures over that exact Safe intent hash, packs sorted signatures into `execTransaction` calldata, and submits a real executor-owned raw transaction to the Safe contract.
- Safe relay assembly now fail-closes stale or malformed signer sets before broadcast: signatures tied to the wrong Safe intent hash and duplicate signer-address entries are rejected instead of being counted toward threshold execution.
- Solana stablecoin withdrawals now use the same FROST treasury-signing path as native SOL withdrawals: custody pre-creates the required treasury and recipient ATAs, builds a single-signature SPL-token transfer message from the treasury owner, and aggregates threshold shares over that exact message.
- Deposit sweeps no longer collect placeholder external `/sign` responses in multi-signer mode before broadcasting with a locally derived deposit key. The worker now clears any stale sweep signature payloads and marks those jobs as explicitly locally signed, matching the real hot-key sweep path instead of implying threshold authorization that never reaches chain broadcast.
- Multi-signer deposit issuance is now hard-disabled instead of continuing to accept new funds into a locally signed sweep path while deposit sweeps remain outside the threshold boundary.
- The sweep worker now applies the same fail-closed policy to pre-existing queued/signing/signed jobs and to the broadcast backstop itself, so multi-signer mode no longer keeps a hidden local-sweep execution path alive for already-issued deposits.
- Reverted or failed on-chain sweep receipts now move the job into a real failure path and emit `sweep.failed` instead of remaining stuck in `sweep_submitted` with no credit or reserve updates.
- Newly issued deposit addresses can now derive from a dedicated deposit root that is separate from the treasury root. Each persisted deposit record carries its seed provenance so already-issued deposits remain sweepable from the original treasury-root derivation path while newer deposits can reduce blast radius if operators provision a separate deposit secret.
- Native SOL sweep accounting no longer over-credit the user by the fee payer delta: sweep jobs persist a post-fee `credited_amount`, credit creation uses that net amount for native SOL, and fee-dust balances stay retriable with an explicit waiting error instead of being marked terminally failed.

This materially reduces `H-6`, but it does **not** fully close the finding yet: deposit sweeps still sign locally from derived deposit keys, so custody still stops short of one complete end-to-end production-grade threshold architecture across deposit, sweep, and withdrawal flows.

**Focused validation completed**

- `cargo check -p lichen-custody`
- `cargo test -p lichen-custody -- --nocapture`
- `cargo test -p lichen-custody tests::test_determine_withdrawal_signing_mode_self_custody -- --exact`
- `cargo test -p lichen-custody tests::test_determine_withdrawal_signing_mode_routes_native_solana_to_frost -- --exact`
- `cargo test -p lichen-custody tests::test_determine_withdrawal_signing_mode_routes_solana_stablecoin_to_frost -- --nocapture`
- `cargo test -p lichen-custody tests::test_determine_withdrawal_signing_mode_routes_threshold_evm_to_safe -- --exact`
- `cargo test -p lichen-custody tests::test_build_threshold_solana_withdrawal_message_rejects_dust -- --exact`
- `cargo test -p lichen-custody tests::test_build_threshold_solana_withdrawal_message_supports_stablecoins -- --nocapture`
- `cargo test -p lichen-custody tests::test_normalize_evm_signature_promotes_recovery_id -- --exact`
- `cargo test -p lichen-custody tests::test_build_evm_safe_exec_transaction_calldata_uses_exec_selector -- --exact`
- `cargo test -p lichen-custody tests::test_collect_and_assemble_threshold_evm_safe_flow -- --nocapture`
- `cargo test -p lichen-custody tests::test_assemble_signed_evm_tx_rejects_mismatched_safe_hash -- --nocapture`
- `cargo test -p lichen-custody tests::test_assemble_signed_evm_tx_rejects_duplicate_signers -- --nocapture`
- `cargo test -p lichen-custody tests::test_promote_locally_signed_sweep_jobs_clears_placeholder_signatures -- --nocapture`
- `cargo test -p lichen-custody tests::test_promote_locally_signed_sweep_jobs_emits_local_signing_metadata -- --nocapture`
- `cargo test -p lichen-custody tests::test_process_sweep_jobs_multi_signer_uses_local_sweep_path -- --nocapture`
- `cargo test -p lichen-custody tests::test_process_sweep_jobs_multi_signer_without_override_blocks_local_sweep_execution -- --nocapture`
- `cargo test -p lichen-custody tests::test_process_sweep_jobs_confirmed_enqueues_credit_and_updates_status -- --nocapture`
- `cargo test -p lichen-custody tests::test_process_sweep_jobs_reverted_receipt_marks_failed_without_credit -- --nocapture`
- `cargo test -p lichen-custody tests::test_create_deposit_rejects_multi_signer_local_sweep_mode_by_default -- --nocapture`
- `cargo test -p lichen-custody tests::test_process_withdrawal_jobs_burn_caller_mismatch_permanently_fails_without_broadcast -- --nocapture`
- `cargo test -p lichen-custody tests::test_process_withdrawal_jobs_burn_contract_mismatch_permanently_fails_without_broadcast -- --nocapture`
- `cargo test -p lichen-custody tests::test_process_withdrawal_jobs_burn_amount_mismatch_permanently_fails_without_broadcast -- --nocapture`
- `cargo test -p lichen-custody tests::test_process_withdrawal_jobs_burn_method_mismatch_permanently_fails_without_broadcast -- --nocapture`
- `cargo test -p lichen-custody safe`

### H-7. Oracle Authority Is Transitional And Split

**Status:** CLOSED by Task 11

Validator price ingestion now lands as signed native oracle-attestation transactions, the native consensus oracle is the canonical chain-wide price authority, and legacy contract-storage updates are derived from finalized consensus state only as compatibility mirrors.

### M-1. Storage Atomicity Still Overclaims

**Severity:** MEDIUM

**Status:** CLOSED

**Problem**

The block commit path is improved, but still not truly atomic in the strict storage sense implied by comments and architecture claims.

**Required direction**

- move tip updates and finality metadata into the same durable batch as block persistence,
- or stop describing the current path as atomic.

**Closure note**

Canonical block persistence no longer advances `tx_by_slot` sequence state outside the block `WriteBatch`: the forward slot index now derives its sequence from transaction order within the block, so block data, tip metadata, transaction bodies, and canonical transaction indexes commit together in one durable batch. The remaining later finality promotions are separate follow-up writes driven by later votes rather than part of the original block persistence path, and the code/comments now reflect that narrower boundary.

**Validation**

- `cargo test -p lichen-core --lib state::tests::test_put_block_atomic_persists_slot_and_finality_metadata -- --exact`
- `cargo test -p lichen-core --lib state::tests::test_put_block_atomic_does_not_persist_tx_slot_seq_side_counter -- --exact`

### M-2. Bearer-Token Admin Mutation RPCs Remain Non-Standard

**Severity:** MEDIUM

**Status:** CLOSED

**Problem**

Several admin actions still mutate protocol state through bearer-token RPCs instead of signed transactions or governed actions.

**Required direction**

- remove these from public RPC,
- constrain any remaining admin paths to offline or localhost-only maintenance flows,
- migrate state-changing actions to transaction or governance semantics.

**Closure note**

Public-style networks already hard-disabled the legacy mutation RPCs; the remaining local/dev maintenance path is now explicitly loopback-only, and JSON-RPC `Authorization: Bearer ...` authentication is enforced at the router boundary rather than only via legacy body params. That leaves these endpoints as local maintenance affordances instead of a normal remotely reachable control plane.

**Validation**

- `cargo test -p lichen-rpc --test rpc_full_coverage test_native_legacy_admin_rpcs_disabled_on_public_networks -- --exact`
- `cargo test -p lichen-rpc --test rpc_full_coverage test_native_legacy_admin_rpcs_accept_bearer_header_on_dev_networks -- --exact`
- `cargo test -p lichen-rpc --test rpc_full_coverage test_native_legacy_admin_rpcs_require_loopback_on_dev_networks -- --exact`

### M-3. P2P Discovery Is Better, Dissemination Still Looks Transitional

**Severity:** MEDIUM

**Status:** CLOSED

**Problem**

Discovery has improved, but block and transaction propagation still resembles flat broadcast more than a mature overlay.

**Required direction**

- preserve simplicity where latency matters,
- but add bounded-fanout or explicit overlay behavior for non-consensus dissemination.

**Closure note**

Non-consensus dissemination now uses the structured overlay already present in the codebase: block gossip, compact block gossip, and transaction gossip route to the Kademlia-closest peers with bounded fanout, while consensus votes continue to use the existing validator-targeted low-latency path. Full broadcast remains only as the cold-start fallback when the routing table has not been populated yet.

**Validation**

- `cargo test -p lichen-p2p test_non_consensus_targets_use_bounded_kademlia_fanout -- --exact`
- `cargo test -p lichen-p2p test_non_consensus_targets_fall_back_to_all_peers_without_overlay_entries -- --exact`

### M-4. Openness And Operational Hygiene Need Hardening

**Severity:** MEDIUM

**Status:** CLOSED

**Problem**

Critical operational docs are partly ignored or local-only, some deployment/security context is not first-class public repo state, and secret handling patterns still lean too much on repo-adjacent storage.

**Required direction**

- publish redacted but versioned architecture and ops docs,
- enforce no-secrets-in-worktree discipline,
- separate public trust model docs from private credentials.

**Closure note**

The repo boundary is now explicit and truthful: public source, docs, deployment manifests, infra configs, and app/front-end code are treated as tracked repository state, while credentials and operator-only secret material remain isolated in ignored paths such as `internal-docs/` and `VPS_CREDENTIALS.md`. README and CONTRIBUTING no longer describe public directories as local-only, and the ignore policy no longer hides new public docs or deployment artifacts by default.

**Validation**

- verified `.gitignore` now preserves only secret or machine-local exclusions instead of broad public-doc/public-app exclusions
- verified README and CONTRIBUTING describe the current public/private repo boundary consistently

---

## Phase Plan

### Phase 0 — Claim Corrections And Trust-Boundary Cleanup

**Objective:** lock the target architecture, remove ambiguity, and prepare the codebase to make current claims true.

Tasks:

- lock canonical architecture decisions for oracle, custody, finality, proofs, and contract semantics,
- identify every place where code does not yet satisfy the current public claim,
- keep trust-boundary docs precise during the implementation window so operators do not misconfigure production,
- define acceptance tests for each strong public claim before implementation starts.

### Phase 1 — Consensus And Sync Hardening

**Objective:** make the chain defensible to protocol engineers.

Tasks:

- sign all consensus-relevant header fields,
- make sync verification mandatory and exact,
- make warp sync anchored to authenticated checkpoints,
- persist self-contained commit evidence.

### Phase 2 — Contract Platform Unification

**Objective:** turn the contract layer into one coherent public platform.

Tasks:

- choose one dispatch model,
- standardize call success/failure and result encoding,
- replace fake system-address CCC paths with first-class host/runtime APIs,
- unify canonical contract storage,
- make ABI/IDL generation real and codegen-backed.

### Phase 3 — Deterministic Genesis And Authenticated State

**Objective:** eliminate privileged bootstrapping surprises.

Tasks:

- remove live network I/O and wall-clock dependency from genesis,
- freeze genesis manifests and deterministic deployment inputs,
- complete authenticated state-proof semantics with height anchoring,
- align storage comments, commit paths, and actual atomicity.

### Phase 4 — Service Trust Model Hardening

**Objective:** ensure non-consensus components do not undermine the chain.

Tasks:

- complete threshold-signing custody and make it the real production path,
- converge public RPC, DEX, explorer, and wallet price paths onto the native validator oracle as canonical consensus truth,
- remove bearer-token mutation RPCs from production posture,
- harden release, key, and secrets workflows.

### Phase 5 — Public Transparency And Open-Source Credibility

**Objective:** make the public repo tell the truth cleanly.

Tasks:

- track redacted but complete deployment/security docs in Git,
- publish a standards-oriented architecture overview,
- maintain an explicit claims-vs-code checklist for every major subsystem,
- close local-only documentation gaps that prevent independent review.

---

## Recommended Execution Order

If the goal is credibility first, not feature velocity first, the most important order is:

1. **Phase 0** — correct claims and trust-model language immediately.
2. **Phase 1** — make sync and signed-header semantics defensible.
3. **Phase 2** — unify the contract platform before adding more protocol surface.
4. **Phase 4** — harden custody/oracle/admin trust boundaries.
5. **Phase 3** — complete deterministic genesis and authenticated-state rigor.
6. **Phase 5** — publish the operational and architectural truth cleanly.

---

## What Success Looks Like

This audit is successful when an external protocol engineer can say all of the following without qualification:

- joining nodes do not trust unauthenticated peer state,
- signed headers cover all consensus-relevant commitments,
- finality semantics are precise and honest,
- contract execution has one coherent ABI and storage model,
- custody and oracle trust assumptions are explicit and justified,
- operational docs in the public repo are sufficient to evaluate the system seriously.

Until then, the highest-risk failures are not necessarily bugs. They are **credibility failures**.
