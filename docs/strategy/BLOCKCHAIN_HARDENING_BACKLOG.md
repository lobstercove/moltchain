# Blockchain Hardening Backlog

This backlog consolidates the next hardening work discovered during the deeper standards audit.

## Critical

1. Sign `validators_hash` inside the canonical block header hash so validator-set commitments are actually authenticated. Evidence: [core/src/block.rs](../../core/src/block.rs#L222).
2. Anchor initial sync and warp sync to authenticated finalized headers rather than trusting peer-provided order and snapshot data too much. Evidence: [validator/src/sync.rs](../../validator/src/sync.rs#L10).
3. Correct public finality claims until the commitment model is simplified or the terminology is tightened. Evidence: [README.md](../../README.md#L29), [developers/architecture.html](../../developers/architecture.html#L182), [programs/index.html](../../programs/index.html#L1644), [faucet/index.html](../../faucet/index.html#L207).
4. Either finish custody threshold signing end-to-end or remove threshold-signing production claims. Evidence: [custody/src/main.rs](../../custody/src/main.rs#L704).
5. Unify the oracle trust path or expose the split explicitly in every RPC/UI surface. Evidence: [core/src/processor.rs](../../core/src/processor.rs#L4396), [rpc/src/lib.rs](../../rpc/src/lib.rs#L13180), [rpc/src/dex.rs](../../rpc/src/dex.rs#L2603).
6. Remove or heavily constrain admin bearer-token mutation RPCs so protocol changes go through governance or offline operator flow only. Evidence: [rpc/src/lib.rs](../../rpc/src/lib.rs#L3242).
7. Stop overstating light-client readiness until proof bundles are height-anchored to signed headers and authenticated validator sets. Evidence: [rpc/src/lib.rs](../../rpc/src/lib.rs#L3094), [docs/strategy/BLOCKCHAIN_ALIGNMENT_PLAN.md](BLOCKCHAIN_ALIGNMENT_PLAN.md#L1470).

## Medium

1. Replace mixed finality terminology with one precise external model and one precise RPC commitment model.
2. Redesign account-proof APIs to return block-height anchoring material, not just a proof plus state root.
3. Make genesis generation deterministic and reduce privileged live-time mutation where possible.
4. Unify the contract ABI, dispatch, CPI, and storage model. See [docs/strategy/CONTRACT_PLATFORM_UNIFICATION_PLAN.md](CONTRACT_PLATFORM_UNIFICATION_PLAN.md).
5. Separate protocol-owned state reads from contract-owned state reads in a documented host API.
6. Publish honest trust-model docs for custody, oracle, and bridge components.
7. Bring public-facing deployment and operations docs fully in sync with the actual repo-local runtime layout.

## Low / Polish

1. Sweep all websites and developer pages for stale claim fragments like "instant finality" and "threshold-signing custody".
2. Add source labels to oracle endpoints and explorer pages.
3. Auto-generate contract reference tables from machine-readable metadata instead of maintaining them manually.
4. Add diagrams for finality commitments, oracle source paths, and custody trust boundaries.
5. Reduce public confusion around local-only versus published components in repo structure descriptions.

## Sequencing

1. First fix claim accuracy and remove misleading language.
2. Then fix the protocol-trust gaps that make the strongest claims unsafe.
3. Then unify the contract platform so future features do not add another layer of semantic drift.