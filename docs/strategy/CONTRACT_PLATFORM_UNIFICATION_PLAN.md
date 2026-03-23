# Contract Platform Unification Plan

This document defines the rewrite direction needed to make Lichen's contract platform coherent across ABI, dispatch, CPI, storage, compiler output, and SDKs.

## Current State

### 1. Two contract ABIs are live at once

The runtime currently supports:

- named-export ABI with typed WASM parameters,
- opcode ABI with a zero-arg `call()` entrypoint that pulls bytes via host imports.

See [core/src/contract.rs](../../core/src/contract.rs#L893).

This is functional, but it makes toolchains, docs, and debugging harder than necessary.

### 2. Dispatch is logically unified but semantically fragmented

All contract calls flow through one contract program entrypoint in the processor, but individual contracts still expose different ABI conventions and dispatch styles. See [core/src/processor.rs](../../core/src/processor.rs#L1292).

### 3. CPI semantics are not described the same way the runtime implements them

- Runtime comments describe synchronous non-reentrant cross-contract dispatch. See [core/src/contract.rs](../../core/src/contract.rs#L687).
- Developer docs still say cross-contract calls can be re-entered. See [developers/contracts.html](../../developers/contracts.html#L1271).

That mismatch will keep causing contract authors to encode the wrong safety assumptions.

### 4. Storage access is partly generic and partly special-cased

The processor injects special cross-contract storage data for LichenID reputation lookups rather than relying on one canonical cross-program read model. See [core/src/processor.rs](../../core/src/processor.rs#L4704).

### 5. Oracle and protocol state live across different storage domains

- Contract state uses contract storage.
- Native oracle consensus prices live in `CF_STATS`.
- Public RPC/UI price reads currently go through contract storage.

This is a concrete example of why platform state and application state need cleaner boundaries.

## Target Principles

1. One canonical contract ABI.
2. One canonical dispatch model.
3. Explicit CPI semantics with stable failure, value-transfer, event, and rollback rules.
4. One documented state access model for contracts.
5. One IDL/metadata system shared by Rust, JS, Python, CLI, and explorer tooling.

## Recommended End State

### ABI

- Canonicalize on one ABI format for all newly built contracts.
- Prefer a single byte-oriented invocation envelope plus generated bindings rather than hand-maintained dual conventions.
- Introduce an IDL that defines functions, argument types, return types, events, errors, and storage schemas.

### Dispatch

- Use one exported entrypoint for every contract.
- Dispatch internally using function selectors generated from the IDL.
- Preserve human-readable function names in metadata and SDK bindings rather than in runtime ambiguity.

### CPI

- Define CPI as synchronous, depth-bounded, and non-reentrant unless the runtime is intentionally redesigned.
- Specify exact atomicity: storage changes, emitted events, logs, and value transfers must either commit together or revert together at the documented boundary.
- Replace ad hoc cross-contract storage injections with explicit CPI reads or dedicated host calls.

### Storage

- Separate protocol-owned state from contract-owned state clearly.
- Provide a documented path for contracts to read protocol data, rather than reaching across storage namespaces indirectly.
- Define proof and indexing behavior around that state model so RPC can expose consistent proof and explorer semantics.

## Rewrite Phases

### Phase 0: Freeze semantics

Before changing code shape, freeze and document the intended semantics for:

- call encoding,
- CPI success and rollback,
- return data,
- event/log visibility,
- value transfer behavior,
- protocol-state reads.

Acceptance criteria:

- one authoritative contract execution semantics document,
- developer portal updated to match runtime behavior,
- old contradictory guidance removed.

### Phase 1: Introduce canonical IDL

Build a chain-level IDL format and generate bindings for Rust, JS, Python, CLI, and explorer decoding.

Acceptance criteria:

- every first-party contract exports machine-readable IDL,
- SDKs generate calls from the same schema,
- explorer and docs render from IDL rather than hand-maintained tables.

### Phase 2: Canonical ABI and entrypoint

Move new contracts to one entrypoint and one call envelope. Keep the old runtime only as a migration bridge, not as the long-term platform model.

Acceptance criteria:

- contract compiler emits one ABI style by default,
- new contract templates use one entrypoint,
- compatibility layer is isolated and explicitly deprecated.

### Phase 3: CPI redesign

Replace special-case CPI patterns with explicit call descriptors and protocol-read APIs.

Acceptance criteria:

- no LichenID-specific storage injection in processor path,
- CPI docs match implementation exactly,
- nested-call tests cover rollback, events, value transfer, and depth limits.

### Phase 4: Storage unification

Define contract-readable protocol views for validator set, oracle prices, and other protocol data without blurring protocol CFs and contract storage.

Acceptance criteria:

- RPC identifies storage source and trust domain,
- contracts use stable host APIs for protocol reads,
- proof model is documented for both contract state and protocol state.

### Phase 5: Migration and cleanup

Once all first-party contracts and SDKs are moved, remove the public notion that multiple ABI families are first-class forever.

Acceptance criteria:

- docs reference one platform model,
- SDKs do not require ABI-specific manual branching,
- developer portal and playground examples all use the same style.

## Priority Tasks

### Critical

1. Fix the documentation/runtime mismatch for CPI semantics.
2. Stop adding new contracts in multiple ABI styles.
3. Replace special-case storage injection with explicit platform APIs.

### Medium

1. Build the IDL and generated bindings.
2. Unify contract metadata across explorer, CLI, and SDKs.
3. Define proof and indexing semantics for contract-visible protocol data.

### Polish

1. Auto-generate developer portal contract tables from IDL.
2. Add contract execution traces to explorer and testing tools.
3. Publish a migration guide for existing contracts.