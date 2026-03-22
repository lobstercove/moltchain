# Custody And Oracle Trust Model

This memo describes what operators and users are actually trusting today in custody and oracle-related services.

## Executive Summary

MoltChain currently exposes two trust-sensitive surfaces that should not be described with stronger wording than the code supports:

1. Custody is still an operator-trusted signing and deposit-tracking service, not a production-complete threshold-signing custody stack.
2. Oracle data currently comes from two different systems with different trust assumptions: a native validator-attested oracle path and a separate MoltOracle contract path.

## Custody

### What the code does today

- Treasury signing still derives from one treasury master seed, but deposit issuance can now use a separate optional deposit master seed. If operators do not configure a separate deposit secret the service falls back to the treasury root, preserving the old behavior. Each persisted deposit record now carries its seed provenance so already-issued deposits remain sweepable after the split. See [custody/src/main.rs](../../custody/src/main.rs#L197), [custody/src/main.rs](../../custody/src/main.rs#L229), and [custody/src/main.rs](../../custody/src/main.rs#L1567).
- New deposit addresses are deterministically issued from the active deposit root using a per-user BIP44-style derivation path, and the custody service persists both that derivation path and the deposit seed source with each deposit record. In multi-signer mode, new deposit issuance remains hard-disabled until deposit sweeps have a real threshold architecture. See [custody/src/main.rs](../../custody/src/main.rs#L1018).
- Native Solana treasury withdrawals with `>1` signer endpoints now route through the two-round FROST coordinator instead of the generic single-round `/sign` flow. See [custody/src/main.rs](../../custody/src/main.rs#L3597) and [custody/src/main.rs](../../custody/src/main.rs#L7020).
- Multi-signer startup now warns about the exact support boundary instead of aborting behind an unsafe override. Solana treasury withdrawals now have a real FROST path for both native SOL and SPL stablecoins, and EVM withdrawals now use Safe-owner signatures plus a coordinator-submitted executor transaction.
- Deposit sweeps are still signed locally by re-deriving the per-deposit private key from the stored derivation path and the persisted seed source, then sending the funds into the configured treasury address. The worker no longer pretends those sweeps are externally threshold-signed when signer endpoints are configured; it clears any placeholder sweep signatures and promotes the job as explicitly locally signed before broadcast. Native SOL sweeps now also persist a post-fee credited amount so the downstream credit path matches the actual treasury intake, and fee-dust balances remain retriable instead of failing terminally. See [custody/src/main.rs](../../custody/src/main.rs#L2238), [custody/src/main.rs](../../custody/src/main.rs#L3130), and [custody/src/main.rs](../../custody/src/main.rs#L3365).
- FROST endpoints and Safe-executor wiring now back live treasury-withdrawal paths on Solana and EVM, but custody still does not expose one complete production threshold architecture across every chain. Deposit sweeps remain locally signed from derived deposit keys.

### Actual trust model today

- Operators still trust the secrecy and operational handling of hot derivation roots. A dedicated deposit root can now reduce coupling with the treasury root, but deposit sweeps remain hot-key operations and legacy deposits may still resolve against the treasury root when that was the issuing source.
- Users trust the custody operator to manage deposits and sweep funds correctly, and they can rely on real threshold withdrawal paths today for Solana treasury withdrawals and EVM Safe withdrawals.
- The effective threshold boundary today is still the treasury, not the deposit address: treasury withdrawals can be threshold-protected, while deposit sweeps still rely on locally derived keys. In multi-signer mode, that mismatch is now fail-closed by default for both new deposit issuance and pre-broadcast local sweep execution.
- In practical production terms, custody now mixes live threshold treasury-withdrawal paths with one still-centralized sweep model. It is closer to a staged threshold system, but not yet a fully chain-wide threshold HSM architecture.

### Correct public wording

Use:

- "Custody deposit tracking and signer orchestration service"
- "Threshold-protected treasury withdrawals with locally signed deposit sweeps"

Do not use:

- "Threshold-signing custody"
- "Production threshold signer"
- "Decentralized custody"

### Critical actions

1. Either finish end-to-end FROST wiring in sweep and withdrawal flows or remove threshold-signing language everywhere.
2. Decide whether the remaining hot-seed architecture is temporary or strategic. If temporary, publish the replacement plan.
3. Publish the exact custody boundary in deployment docs: threshold treasury withdrawals are live on supported paths, but deposit sweeps still rely on locally derived hot keys.

## Oracle

### What the code does today

There are two separate oracle systems.

#### Native validator oracle

- Validators can submit native oracle attestations through system instruction type 30. See [core/src/processor.rs](../../core/src/processor.rs#L4396).
- Attestations are stored in `CF_STATS` and aggregated into a consensus price after a strict greater-than-2/3 active-stake threshold using a stake-weighted median. See [core/src/state.rs](../../core/src/state.rs#L6793) and [core/src/processor.rs](../../core/src/processor.rs#L4490).

#### MoltOracle contract

- The contract has an owner, asset-specific authorized feeders, and owner-managed authorized attesters. See [contracts/moltoracle/src/lib.rs](../../contracts/moltoracle/src/lib.rs#L18), [contracts/moltoracle/src/lib.rs](../../contracts/moltoracle/src/lib.rs#L41), and [contracts/moltoracle/src/lib.rs](../../contracts/moltoracle/src/lib.rs#L80).
- Contract prices are stored under contract storage keys such as `price_<asset>`. See [contracts/moltoracle/src/lib.rs](../../contracts/moltoracle/src/lib.rs#L171).

#### Public RPC and DEX path

- `getOraclePrices` reads ORACLE contract storage, not the native consensus oracle records in `CF_STATS`. See [rpc/src/lib.rs](../../rpc/src/lib.rs#L13180).
- The DEX REST oracle endpoint also reads ORACLE contract storage. See [rpc/src/dex.rs](../../rpc/src/dex.rs#L2603).

### Actual trust model today

- The native validator oracle is a consensus-weighted protocol primitive.
- The MoltOracle contract is an application-layer oracle service with owner-managed authorization.
- The public RPC/UI oracle path currently follows the contract storage path, not the native validator consensus price path.

That means public users are not consuming one unified oracle trust model today.

### Correct public wording

Use:

- "Native validator-attested oracle for consensus prices"
- "MoltOracle contract for application-managed feeds, VRF, and attestations"
- "Current UI/API price feeds follow the MoltOracle contract storage path"

Do not use:

- "One decentralized oracle"
- "Unified oracle consensus path"
- "Oracle multi-source attestation complete" without qualifying which path is complete

### Critical actions

1. Decide which oracle is canonical for user-facing prices: native consensus oracle or contract oracle.
2. Make RPC responses identify the source explicitly.
3. Remove any UI/API copy that treats the two paths as the same thing.

## Combined Risk Assessment

### Critical

1. Custody threshold-signing claims exceed the deployed production path.
2. Public oracle messaging collapses two distinct trust models into one.
3. RPC/UI oracle consumers are not clearly told whether they are seeing validator consensus prices or contract-managed prices.

### Medium

1. Seed-centralized custody may be acceptable operationally for now, but only if it is described honestly and protected operationally.
2. The oracle split can remain temporarily if every API surface names the source and guarantees precisely.

### Polish

1. Add diagrams to the developer portal showing the native oracle path versus contract oracle path.
2. Add a short "trust assumptions" section to custody and oracle docs.
3. Add source metadata fields to explorer and wallet displays for oracle prices.