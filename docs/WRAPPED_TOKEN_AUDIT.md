# Wrapped Token Audit — Full Consistency Fix

**Date:** 2025-06-01  
**Scope:** wBNB, wETH, wSOL, mUSD contracts + RPC + Processor + Custody + Deployment  
**Goal:** One naming convention, one admin flow, no silent failures. Fix everything before full reset.

---

## 1. ROOT CAUSES

### 1.1 Admin Mismatch (CRITICAL)

**Symptom:** `wBNB supply = 0` despite successful-looking mint transactions.

**Root cause:** The contract admin (set during `initialize()`) is the deployer keypair that ran `deploy_dex.py`. The custody service uses a DIFFERENT keypair from `/etc/moltchain/custody-treasury.json`. When custody calls `mint()`, the contract checks `require_admin(&caller)` → returns error code 2 ("not admin") → BUT the transaction is recorded as "Success" because of issue 1.2.

- **On-chain admin:** `GVD47QVrUjxGjHjXUGckFFXH5eJ17QhueaXgkQiMe5Lw` (hex: `e6193214...`)
- **Custody signer:** `8iykgfHqNZYt5vfhpy5tANn7ERTvUNRiAdAbJo8ZayD6` (from custody-treasury.json)
- **Validator:** `6mBZ8KxgPnxikiVjssDUierdiMpGwuvnc5G25PZPBSfD` (different again)

**Affected contracts:** All 4 wrapped tokens (wBNB, wETH, wSOL, mUSD) — same pattern.

**Fix:** On reset, use the SAME keypair for deployment AND custody minting. The custody treasury keypair (`/etc/moltchain/custody-treasury.json`) must be the deployer.

### 1.2 Silent Failure in Processor (CRITICAL)

**Location:** `core/src/processor.rs` lines 3367-3381

**Problem:** When a contract returns `success = true` (no WASM trap) but a non-zero return code (e.g., 2 = "not admin") with zero storage changes, the processor only logs an `eprintln!` warning. The transaction is still committed as "Success" to the ledger.

This means:
- Failed mints look successful in the explorer
- No error visible to the custody service
- Silent data loss — no tokens minted, no error propagated

**Fix:** When `return_code != 0` AND storage changes are empty, fail the transaction with `Err(...)`. This makes contract errors visible to callers.

### 1.3 wBNB Missing from Deployment Script

**Location:** `tools/deploy_dex.py`

**Problem:** `PHASE_1_TOKENS` only lists musd_token, wsol_token, weth_token. wBNB was NOT included. Also missing from:
- `phase_initialize_tokens()` — no `wbnb_token` initialization
- DEX token registration — no `wBNB` registered with dex_core
- Trading pairs — no `wBNB/mUSD` or `wBNB/MOLT` pairs
- Deploy manifest — no `wBNB` in `token_contracts`

**Fix:** Add wBNB everywhere in deploy_dex.py.

### 1.4 Missing getWbnbStats RPC Endpoint

**Location:** `rpc/src/lib.rs`

**Problem:** There are stat endpoints for mUSD, wETH, wSOL but NOT for wBNB. The RPC dispatch table (line 2054-2056) has no `getWbnbStats` entry.

**Fix:** Add `handle_get_wbnb_stats()` matching the pattern of the other three.

---

## 2. NAMING CONVENTION — Decision

### Storage keys in contracts

All 4 wrapped token contracts consistently use `{prefix}_` prefixed keys:

| Contract   | Supply Key      | Admin Key      | Balance Key         | Allowance Key            |
|------------|-----------------|----------------|---------------------|--------------------------|
| wbnb_token | `wbnb_supply`   | `wbnb_admin`   | `wbnb_bal_{hex}`    | `wbnb_alw_{hex}_{hex}`   |
| weth_token | `weth_supply`   | `weth_admin`   | `weth_bal_{hex}`    | `weth_alw_{hex}_{hex}`   |
| wsol_token | `wsol_supply`   | `wsol_admin`   | `wsol_bal_{hex}`    | `wsol_alw_{hex}_{hex}`   |
| musd_token | `musd_supply`   | `musd_admin`   | `musd_bal_{hex}`    | `musd_alw_{hex}_{hex}`   |

**SDK `Token` standard** (`sdk/src/token.rs`) uses unprefixed keys: `total_supply`, `balance:`, `allowance:`.

### Decision: Keep `{prefix}_supply` — NO changes to contracts

Rationale:
- All 4 contracts are consistent with each other
- Each contract has its own CF_CONTRACT_STORAGE namespace (keyed by program address), so collisions aren't possible, but prefixes are useful for debugging raw storage
- The SDK `Token` is for user-created generic tokens, a separate concern
- Changing 4 battle-tested contracts just for naming purity is unnecessary risk

### RPC reads

The RPC `getContractInfo` already has a fallback scan for `_supply` suffix keys (line 6203-6214). This works correctly. The only issue is it tries `b"total_supply"` first, which returns nothing for wrapped tokens, then falls through to the scan.

**Fix:** Reorder to scan `_supply` first, then `total_supply`. Makes it primary, not fallback.

The `getMusdStats`, `getWethStats`, `getWsolStats` endpoints already read the correct prefixed keys directly (e.g., `b"musd_supply"`). These are fine. Just need to add `getWbnbStats`.

---

## 3. ADMIN FLOW — After Reset

### Single keypair for everything:

1. **Generate deployer keypair** → `keypairs/deployer.json`
2. **Fund deployer** from faucet or genesis treasury (needs MOLT for tx fees)
3. **Deploy all contracts** with deployer as signer → program addresses derived from deployer+wasm hash
4. **Initialize all contracts** with `admin = deployer.public_key()` — deployer calls `initialize(deployer_pubkey_bytes)`
5. **Copy deployer secret key** to `/etc/moltchain/custody-treasury.json` on VPS
6. **Custody service** reads that keypair → uses it to sign mint txs → contract's `require_admin()` matches

### Result: deployer = contract admin = custody signer

This aligns everything with ONE key.

---

## 4. FIXES APPLIED (this commit)

### 4.1 `core/src/processor.rs` — Fail on non-zero contract return code
- When `return_code != 0` + empty storage changes → return `Err(...)` instead of just logging
- Error message includes function name + return code

### 4.2 `rpc/src/lib.rs` — getContractInfo supply read order
- `_supply` suffix scan runs first (handles wrapped tokens)
- `b"total_supply"` read is the fallback (handles SDK-standard tokens)

### 4.3 `rpc/src/lib.rs` — Add getWbnbStats endpoint
- New `handle_get_wbnb_stats()` reading: wbnb_supply, wbnb_minted, wbnb_burned, wbnb_mint_evt, wbnb_burn_evt, wbnb_xfer_cnt, wbnb_att_count, wbnb_reserve_att, wbnb_paused
- Wired in RPC dispatch table

### 4.4 `tools/deploy_dex.py` — Add wBNB to deployment
- Added `wbnb_token` to PHASE_1_TOKENS
- Added to phase_initialize_tokens()
- Added `wBNB` registration with dex_core
- Added `wBNB/mUSD` and `wBNB/MOLT` trading pairs
- Added to deploy manifest

---

## 5. POST-RESET CHECKLIST

After full blockchain reset on both VPS:

- [ ] Generate fresh deployer keypair on VPS US
- [ ] Fund deployer with MOLT from genesis treasury (or faucet)
- [ ] Run `deploy_dex.py` — deploys + initializes all contracts with deployer as admin
- [ ] Copy deployer secret key to `/etc/moltchain/custody-treasury.json`
- [ ] Copy deployer secret key to `/etc/moltchain/custody-env-testnet` as CUSTODY_TREASURY_KEYPAIR
- [ ] Copy deployer secret key to `/etc/moltchain/custody-env-mainnet` as CUSTODY_TREASURY_KEYPAIR
- [ ] Restart custody services (testnet + mainnet)
- [ ] Verify: `getWbnbStats` / `getWethStats` / `getWsolStats` / `getMusdStats` all return data
- [ ] Test: deposit BNB → verify wBNB minted (supply > 0)
- [ ] Save old BNB testnet treasury wallet keys before reset (to sweep funds to new wallet later)
