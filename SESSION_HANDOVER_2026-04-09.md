# Session Handover - 2026-04-09

## Objective

Restore `tests/contracts-write-e2e.py` on the fresh local 3-validator stack, then rerun `tests/production-e2e-gate.sh` only after the contract-write suite is materially green.

## Why This Took So Long

This was not one slow failure. It was a stack of interacting problems that made each full rerun misleading until the harness and signer assumptions were corrected.

1. The local chain is not blank.
   - Several scenarios were written like they were bootstrapping empty contracts.
   - The fresh genesis already contains live DEX state, governance wiring, minter roles, and pre-created contracts.
   - That made some positive steps invalid and some negative steps incorrectly modeled.

2. The suite was using the wrong actors for live permissions.
   - `dex_core` admin is `community_treasury`, not deployer.
   - Wrapped token minter roles point to `genesis-primary`, not `community_treasury`.
   - Until that was verified from on-chain storage, large failure clusters were just permission mismatches.

3. The harness was misclassifying real writes as failures.
   - Many transactions timed out waiting for a receipt even though simulation plus storage/event deltas showed they had succeeded.
   - Several contracts return nonzero success values such as proposal IDs, token IDs, share counts, or amounts. The old logic treated many of those as failures.

4. Activity-floor accounting was inflated.
   - Idempotent `initialize*` calls were still being counted in expected write activity even after they no longer represented real credited writes.
   - That created false `activity_floor` failures even after scenarios were otherwise working.

5. Create-follow-up flows were using simulated return IDs instead of committed on-chain counters.
   - On timeout-success paths, the simulation return could diverge from the actual committed counter if the real transaction had already landed.
   - That broke follow-up calls like `sporepump.buy` and `lichendao.vote` until the harness captured the live on-chain counter instead.

Net effect: repeated reruns were necessary because the failure surface was changing as systemic harness errors were removed. The expensive part was separating harness noise from real contract precondition bugs.

## User Constraints

- Do not do speculative debugging.
- Do not rerun the entire world when a scoped rerun is enough.
- Resume from verified repo/runtime facts only.

## Current Dirty Worktree

- `scripts/start-local-stack.sh`
- `contracts/lichenpunks/src/lib.rs`
- `contracts/lichenpunks/lichenpunks.wasm`
- `tests/contracts-write-e2e.py`
- `tests/production-e2e-gate.sh`
- `tests/resolve-funded-signers.py`

## What Was Already Fixed Before This Slice

- `scripts/start-local-stack.sh`
  - WASM refresh now resolves the actual Cargo artifact name instead of assuming the directory name matches the final artifact.

- `contracts/lichenpunks/src/lib.rs`
  - `owner_of` now writes return data correctly.

- `contracts/lichenpunks/lichenpunks.wasm`
  - Rebuilt to include the `owner_of` return-data fix.

- `tests/production-e2e-gate.sh`
  - Contract-write signer selection prefers the funded signer resolver before falling back.
  - Funding now waits for a confirmed positive balance instead of assuming the transfer or airdrop landed immediately.
  - Contract-write stage now passes both a primary and a secondary signer.

## What Was Done In This Session

### 1. Resumed from saved state instead of restarting discovery

- Reused the prior handoff and repo memory.
- Avoided re-debugging the already-proven DEX facts from scratch.

### 2. Replaced stale suite output with fresh contract-write reruns

Observed progression from completed full reruns:

- Earlier stale baseline carried into this continuation: `PASS=136 FAIL=72 SKIP=0`
- First fresh rerun in this continuation: `PASS=135 FAIL=73 SKIP=0`
- After first harness fixes: `PASS=141 FAIL=66 SKIP=0`
- After additional classifier and ID-capture fixes: `PASS=156 FAIL=51 SKIP=0`

Important: there is no completed full rerun yet after the final wrapped-token signer fix. The next rerun was started and then cancelled.

### 3. Fixed systemic harness problems in `tests/contracts-write-e2e.py`

Key changes:

- Added ABI-driven argument ordering for named contracts instead of relying on the older layout special case.
- Changed `call_contract(...)` to return both the signature and the signed transaction so the exact transaction can be simulated after receipt timeout.
- Added post-timeout simulation handling to distinguish these cases:
  - confirmed write success
  - expected guarded negative rejection
  - read success
  - idempotent positive initialize
- Added stronger success log recognition through `has_strong_success_marker(...)`.
- Reduced false failure detection by not blindly treating generic words like `failed` as fatal when strong success markers are present.
- Added scenario context capture and substitution:
  - `capture_return_code_as`
  - `from_context`
- Added on-chain counter capture for timeout-success create flows:
  - `sporepump.create_token` via `cp_token_count`
  - `lichendao.create_proposal_typed` via `proposal_count`
- Excluded `initialize*` from required expected write activity using `expected_write_step_counts_toward_activity(...)`.
- Prevented idempotent initialize calls from inflating credited activity using `write_step_counts_toward_activity(...)`.

### 4. Fixed scenario definitions to match live contract semantics

High-value scenario corrections included:

- `sporepump`
  - `create_token` now attaches value and captures the real created token ID.
  - `buy` now uses the captured token ID and attaches value.

- `lichendao`
  - `create_proposal_typed` now uses the actual pointer/length style arguments and captures the real proposal ID.
  - `vote` now uses the captured proposal ID.

- `dex_core`
  - `create_pair` is modeled as the expected duplicate-pair guarded negative on the live genesis chain.
  - `update_pair_fees` uses live-valid values.
  - `place_order` uses the live lot/tick assumptions and attaches native value.

- Wrapped tokens
  - Positive `mint` steps were moved to actor `secondary`.
  - Negative mint validation was adjusted so it still uses a non-minter actor.

### 5. Verified live permission facts from chain storage instead of assuming them

Verified facts:

- `dex_core` admin pubkey: `72sRfqUFq4iuXiGbec24ZKvdbmu99aqnUpL6mDzcsa5`
- Deployer/genesis-primary pubkey: `56BEsnXNkV9TKLCJXdjxtDTVaS1EXrq9phXTG9uFALE`
- All wrapped token minter slots point to `56BEsnXNkV9TKLCJXdjxtDTVaS1EXrq9phXTG9uFALE`
  - `lusd_minter`
  - `weth_minter`
  - `wsol_minter`
  - `wbnb_minter`

### 6. Updated signer resolution in `tests/resolve-funded-signers.py`

The resolver now:

- Prefers `community_treasury` as the primary contract-write signer.
- Prefers `genesis-primary` as the distinct secondary signer ahead of `builder_grants`.
- Allows the secondary signer to be selected from all discovered candidates, not only currently funded candidates.

Verified current resolver output before stop:

- primary/agent keypair: `data/state-7001/genesis-keys/community_treasury-lichen-testnet-1.json`
- primary pubkey: `72sRfqUFq4iuXiGbec24ZKvdbmu99aqnUpL6mDzcsa5`
- secondary/human keypair: `data/state-7001/genesis-keys/genesis-primary-lichen-testnet-1.json`
- secondary pubkey: `56BEsnXNkV9TKLCJXdjxtDTVaS1EXrq9phXTG9uFALE`

This was the critical last fix for the wrapped-token mint cluster.

## Verified DEX Facts

Do not re-derive these unless a fresh rerun contradicts them.

- `dex_core` is governed by `community_treasury`.
- `dex_pair_count = 7`
- pair 1 is native `LICN / lUSD`
  - base = zero/native address
  - quote = live lUSD program address
  - tick = `1`
  - lot = `1000000`
  - min order = `1000`
- Native sell/order placement on pair 1 requires attached call value.

The DEX-only probe was already consistent with the corrected scenario.

## Last Completed Full Contract-Write Result

Latest completed full run before the final wrapped-token signer change:

- `PASS=156 FAIL=51 SKIP=0`

Remaining failures from that last completed run were concentrated in:

- `compute_market`: 2
- `dex_amm`: 4
- `dex_governance`: 2
- `dex_margin`: 5
- `dex_rewards`: 3
- `dex_router`: 2
- `lichenauction`: 3
- `lichenmarket`: 4
- `lichenoracle`: 3
- `lichenpunks`: 4
- `lichenswap`: 4
- `lusd_token`: 2
- `thalllend`: 4
- `wbnb_token`: 3
- `weth_token`: 3
- `wsol_token`: 3

Interpretation:

- `sporepump` and `lichendao` were effectively recovered by the timeout-success and on-chain-ID fixes.
- The wrapped token cluster was still red in that run because it happened before the final secondary signer change to `genesis-primary`.

## What I Was Doing Right Before Stop

I had just:

- patched `tests/resolve-funded-signers.py` so `secondary` resolves to `genesis-primary`
- patched the wrapped-token scenarios in `tests/contracts-write-e2e.py` so positive mint calls run through actor `secondary`
- verified the resolver output returned:
  - agent = `community_treasury`
  - human = `genesis-primary`

The very next step was a fresh rerun of `tests/contracts-write-e2e.py` to validate whether the wrapped-token mint and token-invariant cluster would drop.

That rerun was cancelled before results came back.

## Current State Right Now

No further validation is running. The active work has been paused to produce this handover.

The highest-value next action is still the same cancelled step: rerun `tests/contracts-write-e2e.py` once with the updated resolver output and compare against the previous `156/51/0` result.

## Next Agent Instructions

1. Do not restart the chain unless health checks show it is broken.
2. Do not re-debug DEX admin/state from scratch unless the fresh rerun contradicts the verified facts above.
3. First rerun only `tests/contracts-write-e2e.py` with the resolver-selected signers.
4. Check whether these clusters drop immediately:
   - `lusd_token`
   - `weth_token`
   - `wsol_token`
   - `wbnb_token`
5. If wrapped tokens improve, triage the remaining real scenario issues by category:
   - ABI mismatch: `compute_market`
   - stale preconditions / bootstrap assumptions: `dex_amm`, `dex_router`, `dex_rewards`, `dex_margin`, `dex_governance`, `lichenswap`
   - ownership / approval / cross-contract state assumptions: `lichenmarket`, `lichenauction`, `lichenpunks`
   - collateral / repayment preconditions: `thalllend`
6. Only after contract-write is materially greener should the agent rerun `tests/production-e2e-gate.sh`.

## Concrete Commands For The Next Agent

Activate the venv:

```bash
source .venv/bin/activate
```

Resolve current signers:

```bash
python tests/resolve-funded-signers.py
```

Run the scoped suite only:

```bash
PYTHONPATH="$PWD/sdk/python" RPC_URL="http://127.0.0.1:8899" AGENT_KEYPAIR="<resolved agent path>" HUMAN_KEYPAIR="<resolved human path>" python tests/contracts-write-e2e.py
```

Primary artifact to inspect after rerun:

- `tests/artifacts/contracts-write-e2e-report.json`

## One-Sentence Resume Prompt

Resume from `SESSION_HANDOVER_2026-04-09.md`; do not re-open solved DEX facts, rerun only `tests/contracts-write-e2e.py` with the resolver-selected `community_treasury` and `genesis-primary` signers, then triage the remaining failures by category from the new report.