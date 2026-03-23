# Public Claim Corrections

This document lists specific public claims that should be corrected immediately so product, documentation, and website language matches the current codebase.

## Immediate Rule

Until the protocol changes land, public surfaces should describe current behavior exactly rather than describing the intended end state.

## Exact Corrections

| Location | Current claim | Why it is too strong | Recommended replacement |
|---|---|---|---|
| [README.md](../../README.md#L5) | "Sub-second BFT finality" | The runtime exposes processed, confirmed, and finalized commitments, and finalized currently advances with a 32-slot depth model rather than a pure one-block BFT-final claim. See [core/src/consensus.rs](../../core/src/consensus.rs#L2816), [developers/architecture.html](../../developers/architecture.html#L171), and [README.md](../../README.md#L29). | "Sub-second block commitment with BFT consensus; finalized commitment currently trails by depth." |
| [README.md](../../README.md#L29) | "Finality | ~200 ms (BFT)" | Current developer-facing architecture docs already say typical commit time is 800ms-1.2s, and finalized commitment is modeled separately from confirmed commitment. See [developers/architecture.html](../../developers/architecture.html#L180) and [core/src/consensus.rs](../../core/src/consensus.rs#L2816). | "Commit latency typically ~800ms-1.2s; finalized commitment currently follows a 32-slot depth model." |
| [README.md](../../README.md#L44) | "Threshold-signing custody service" | Custody startup warns that all keys derive from one master seed, and multi-signer FROST is not wired into production sweep/withdraw pipelines. See [custody/src/main.rs](../../custody/src/main.rs#L682) and [custody/src/main.rs](../../custody/src/main.rs#L704). | "Custody service with deposit tracking and signer orchestration; threshold signing is not yet production-ready." |
| [README.md](../../README.md#L63) | "Threshold-signing custody with deposit tracking" | Same issue as above. The live service is still operator-trusted and single-seed sensitive. | "Custody deposit tracking and signer orchestration service." |
| [faucet/index.html](../../faucet/index.html#L207) | "400ms finality" | This presents a fixed finality number that is stricter than current documented behavior. | "Fast BFT block commitment, typically sub-second." |
| [programs/index.html](../../programs/index.html#L1644) | "instant finality" | "Instant finality" conflicts with the current processed/confirmed/finalized model. | "Fast BFT commitment." |
| [developers/architecture.html](../../developers/architecture.html#L182) | "A block is considered finalized once 2/3+ ... submit commit votes" and "There are no reorgs after finalization." | The chain also exposes a finalized slot that advances by depth, so the public explanation is mixing Tendermint-style finality language with a Solana-style finalized depth label. See [core/src/consensus.rs](../../core/src/consensus.rs#L2816). | Describe three levels explicitly: processed at tip, confirmed at supermajority, finalized after the current safety depth. |
| [developers/contracts.html](../../developers/contracts.html#L1271) | "Cross-contract calls can be re-entered" | Runtime comments and implementation describe synchronous non-reentrant cross-contract calls with bounded depth. See [core/src/contract.rs](../../core/src/contract.rs#L687) and [core/src/contract.rs](../../core/src/contract.rs#L1762). | "Cross-contract calls are synchronous and depth-bounded; design contract logic assuming nested calls, but not unrestricted re-entrancy." |
| [developers/contract-reference.html](../../developers/contract-reference.html#L1149) | "Decentralized oracle" | The contract oracle is owner-managed for feeder and attester authorization, while the native validator oracle is a separate consensus mechanism. See [contracts/lichenoracle/src/lib.rs](../../contracts/lichenoracle/src/lib.rs#L41), [contracts/lichenoracle/src/lib.rs](../../contracts/lichenoracle/src/lib.rs#L80), [core/src/processor.rs](../../core/src/processor.rs#L4396), and [rpc/src/dex.rs](../../rpc/src/dex.rs#L2603). | "Oracle contract for owner-managed feeds, VRF, and attestations; separate from the native validator oracle path." |

## Messaging Rules To Apply Everywhere

1. Use "commit latency" or "block commitment" unless the page explains the processed, confirmed, and finalized distinction.
2. Do not call custody "threshold-signing" in production-facing copy until FROST is wired end-to-end in sweep and withdrawal paths.
3. Distinguish the native validator oracle from the LichenOracle contract on every public page.
4. Avoid "light client ready" phrasing until proof bundles are anchored to signed headers and validator-set commitments are fully authenticated.
5. Avoid describing cross-contract execution as re-entrant unless runtime semantics are intentionally changed to allow that.