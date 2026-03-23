# IBC Exploration & Scoping — Task 4.4 (H-14)

> **Status**: Research complete. IBC-lite feasible. Full IBC deferred to a post-alignment follow-on workstream.

## 1. Executive Summary

Lichen currently has no trustless cross-chain protocol. The existing LichenBridge contract uses a multi-sig validator set (N-of-M confirmation) for lock-and-mint bridging — a trust-minimized but not trustless design.

This document scopes what would be needed for IBC (Inter-Blockchain Communication) integration and recommends a phased approach.

## 2. What IBC Requires

IBC (Cosmos ICS specification) is built on three pillars:

1. **Light Client Verification** — Each chain runs a light client of the counterparty chain, verifying block headers and commit certificates without downloading the full blockchain.

2. **State Proofs** — Each chain can prove account/storage state via Merkle inclusion proofs verified against a committed state root.

3. **Relayer Protocol** — Off-chain relayers shuttle packets between chains. They are untrusted — they only deliver proofs that the on-chain light clients verify.

### IBC Protocol Stack

| Layer | ICS Spec | What It Does |
|-------|----------|--------------|
| Light Client | ICS-2 | Verify counterparty headers + commit certs |
| Connection | ICS-3 | Establish trust between two chains |
| Channel | ICS-4 | Ordered/unordered packet delivery |
| Token Transfer | ICS-20 | Fungible token transfer standard |
| Interchain Accounts | ICS-27 | Execute txs on remote chain |

## 3. Lichen's Existing Primitives

### 3.1 Commit Certificates (Phase 1, Task 1.2) ✅

```
CommitSignature {
    validator: [u8; 32],     // Ed25519 pubkey
    signature: [u8; 64],     // Over (0x02 || height || round || block_hash || timestamp)
    timestamp: u64,
}
```

- Stored in `BlockHeader.commit_signatures`
- `verify_commit()` checks 2/3+ stake supermajority
- **IBC relevance**: A counterparty light client can verify Lichen block validity by checking commit signatures against the known validator set — same as Cosmos/CometBFT.

### 3.2 Account State Proofs (Phase 1, Task 1.3) ✅

```
AccountProof {
    pubkey: Pubkey,
    account_data: Vec<u8>,       // bincode-serialized Account
    proof: MerkleProof,          // Siblings + path from leaf to root
    state_root: Hash,            // Block state root this proof was generated against
}
```

- `get_account_proof(&pubkey)` generates inclusion proofs
- `MerkleProof::verify(&expected_root)` verifies proof client-side
- **IBC relevance**: Counterparty chains can verify Lichen account states using these proofs, keyed to a block's state_root from a verified header.

### 3.3 BFT Finality (Existing) ✅

- Tendermint-style instant finality (no rollbacks after commit)
- 2/3+ weighted stake required for block production
- **IBC relevance**: Instant finality means no confirmation delays — a committed block is final, making light client verification straightforward.

### 3.4 Deterministic State (Task 3.2) ✅

- BFT timestamps from stake-weighted median of validator proposals
- Deterministic block production — same inputs always produce same outputs
- **IBC relevance**: Determinism is required for relayers to reconstruct and verify state transitions.

## 4. What's Missing for Full IBC

### 4.1 Light Client Module (NOT IMPLEMENTED)

**Requirement**: Lichen needs an on-chain module (WASM contract or native instruction) that can:
- Store and update counterparty chain's validator set
- Verify counterparty block headers using their commit certificates
- Track counterparty chain's consensus state (latest height, root, next validators hash)

**Effort**: Medium-High. For Cosmos chains, this means implementing Tendermint light client verification (header + commit sig checking). For Ethereum, this would require sync committee verification (much more complex).

### 4.2 Connection & Channel Handshake (NOT IMPLEMENTED)

**Requirement**: Protocol-level state machines for:
- 4-step connection handshake (Init → Try → Ack → Confirm)
- 4-step channel handshake (OpenInit → OpenTry → OpenAck → OpenConfirm)
- Packet commitment storage (hash of packet data committed to state)
- Packet acknowledgement storage
- Timeout handling

**Effort**: High. This is the bulk of the IBC implementation — hundreds of state transitions and proofs.

### 4.3 Cosmos Chain Registry (NOT IMPLEMENTED)

**Requirement**: To connect to the IBC ecosystem:
- Register on Cosmos chain registry
- Provide chain metadata (chain_id, bech32 prefix, denomination, RPC endpoints)
- Support IBC relayer software (Hermes, go-relayer)

**Effort**: Low (administrative, not technical).

### 4.4 Contract Storage Proofs (PARTIAL)

**Gap**: Current `AccountProof` proves account-level state but not individual contract storage key-value pairs. ICS-20 token transfers would need to prove specific storage values (e.g., locked balance in escrow).

**Fix**: Extend the proof system to support storage-level Merkle proofs. This requires a secondary Merkle tree over contract storage entries.

## 5. Recommended Approach: IBC-Lite

Rather than implementing the full IBC stack immediately, a phased approach:

### Phase A: Light Client Contract (Prerequisite)

Deploy a WASM contract (`ibc_light_client`) that:
- Stores a Cosmos chain's validator set + consensus state
- Accepts `UpdateClient` messages with new headers + commit sigs
- Verifies validator signatures using Ed25519 (already supported in WASM host functions)
- Tracks latest verified height and state root

**Estimate**: 1 WASM contract + test suite.

### Phase B: Proof Verification + Packet Relay

Deploy a WASM contract (`ibc_handler`) that:
- Implements ICS-4 channel state machine (simplified, single channel)
- Accepts relayed packets with Merkle proofs from the counterparty
- Verifies proofs against the light client's stored state root
- Commits packet acknowledgements to state

**Estimate**: 1 WASM contract + relayer integration.

### Phase C: ICS-20 Token Transfer

Deploy a WASM contract (`ibc_transfer`) that:
- Implements fungible token transfer with escrow/mint/burn logic
- Integrates with the IBC handler for packet sending/receiving
- Handles timeout refunds

**Estimate**: 1 WASM contract + standard ICS-20 flow.

### Phase D: Relayer Integration

- Adapt Hermes relayer to support Lichen's RPC format
- Configure connection and channel between Lichen and a Cosmos testnet
- End-to-end testing of token transfers

**Estimate**: Hermes plugin + configuration.

## 6. Alternatives Considered

### 6.1 Current LichenBridge (In Use)

- Multi-sig validator confirmation (N-of-M)
- Trust model: trust the bridge validator set (subset of chain validators)
- Pros: Simple, works today, already deployed
- Cons: Not trustless, requires honest majority of bridge validators

### 6.2 Hash Time-Locked Contracts (HTLC)

- Atomic swaps using hashlocks + timelocks
- Trust model: Trustless but requires both parties online
- Pros: Simple, stateless
- Cons: Requires counterparty coordination, limited to 2-party swaps

### 6.3 ZK-Bridge

- Use ZK proofs to verify counterparty chain state
- Trust model: Trustless, math-only verification
- Pros: Most secure, minimal trust assumptions
- Cons: Extremely complex, long proof generation times, high compute cost
- Lichen already has Groth16/BN254 support — could be leveraged

## 7. Decision: Defer Full IBC

**Decision**: Full IBC implementation is deferred. The existing LichenBridge provides adequate cross-chain functionality for current needs. The foundations (commit certs, state proofs, BFT finality) are in place for future IBC-lite when ecosystem demand materializes.

This satisfies the original alignment-plan task because Task 4.4 was explicitly a research and scoping deliverable, not a commitment to ship full IBC inside the closed alignment plan.

**Next steps when IBC is prioritized**:
1. Implement Phase A (light client contract)
2. Connect to Cosmos testnet via Phase B + C
3. Register on chain registry (Phase D)

## 8. Comparison with Real Chains

| Capability | Cosmos | Lichen (Current) | Lichen (With IBC-Lite) |
|-----------|--------|---------------------|--------------------------|
| Light client verification | Full IBC | Commit certs available, no LC module | LC contract + proof verification |
| State proofs | Merkle IAVL | Merkle SHA-256 proofs ✅ | Extended with storage proofs |
| Cross-chain tokens | ICS-20 | LichenBridge (multi-sig) | ICS-20 contract |
| Relayer support | Hermes, go-relayer | None | Hermes plugin |
| Finality model | Instant (BFT) | Instant (BFT) ✅ | Same |
| Validator set tracking | Tendermint LC | N/A | LC contract tracks counterparty |

---

*Created as part of Blockchain Alignment Plan Phase 4, Task 4.4 (H-14). The implementation path, if pursued, belongs to post-alignment follow-on work.*
