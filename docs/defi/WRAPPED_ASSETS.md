# Lichen DEX — Wrapped Assets Architecture (Option B)

> **Decision**: Every external asset deposited into Lichen becomes a **wrapped receipt token** backed 1:1 by reserves in the treasury custody boundary. Treasury withdrawals now have live threshold paths on Solana and EVM, while deposit sweeps are still performed with locally derived deposit keys. lUSD is the unified quote asset; wSOL and wETH are the base trading assets.

---

## Token Map

| Deposit (external) | Receives on Lichen | Type | Contract | Decimals |
|--------------------|-----------------------|------|----------|----------|
| USDT (SOL/ETH) | **lUSD** | Stable quote | `lusd_token` | 6 |
| USDC (SOL/ETH) | **lUSD** | Stable quote | `lusd_token` | 6 |
| SOL | **wSOL** | Wrapped base | `wsol_token` | 9 |
| ETH | **wETH** | Wrapped base | `weth_token` | 18 |
| LICN (native) | **LICN** | Native (no wrapping) | — | 9 |

> **Key**: USDT and USDC both produce lUSD. The user picks which stablecoin to deposit; the treasury holds both, the user receives one unified token.

---

## Complete Deposit Flow (A → Z)

### Step 1: User Requests Deposit Address

```
User (on DEX or wallet UI)
  → selects asset & network: e.g. "USDC on Solana"
  → clicks "Deposit"
     │
     ▼
Frontend calls:  POST /deposits { user_id: "<lichen_pubkey>", chain: "solana", asset: "usdc" }
     │
     ▼
Custody Service (port 9105)
  → generates deposit_id (UUID)
  → derives HD address: SHA-256("lichen/solana/usdc/{user_id}/{index}") → Ed25519 seed
  → for SPL tokens: computes Associated Token Account (ATA) and creates it on Solana
  → stores DepositRequest in RocksDB with status "issued"
  → returns { deposit_id, address: "7xKXtg2CW87..." }
     │
     ▼
Frontend shows one-time deposit address + QR code
```

### Step 2: User Sends Funds

```
User sends 500 USDC to the one-time Solana address
  (or sends SOL, ETH, USDT — same flow per chain)
```

### Step 3: Watcher Detects Deposit

```
Custody Service — solana_watcher_loop (runs continuously)
  → iterates all "issued" deposits for chain=solana
  → for SPL tokens: calls getTokenAccountBalance on the ATA
  → detects 500 USDC arrived and is finalized
  → updates deposit status: "issued" → "confirmed"
  → enqueues SweepJob with status "queued"
```

For EVM deposits, `evm_watcher_loop` does the equivalent using `eth_getBalance` (native) or `eth_getLogs` (ERC-20 Transfer events).

### Step 4: Sweep to Treasury

```
Custody Service — sweep_worker_loop
  → picks up SweepJob, transitions: "queued" → "signing"
  → marks the job as locally signed because deposit sweeps still use the derived deposit key
  → transitions: "signing" → "signed"
  → broadcasts sweep transaction:
      • Solana SPL: Token Program transfer from deposit ATA → treasury ATA
      • Solana native: system transfer from deposit address → treasury address
      • EVM ERC-20: transfer() call to token contract
      • EVM native: signed ETH transfer
  → transitions: "signed" → "sweep_submitted"
  → monitors on-chain confirmation
  → transitions: "sweep_submitted" → "sweep_confirmed"

Funds are now in the treasury wallet boundary.
Nothing changes here from the current system.
```

### Step 5: Credit User on Lichen ← THE PART THAT CHANGED

**Old system** (replaced):
```
credit_worker_loop → submit_licn_credit()
  → builds system transfer (opcode 0) of native LICN
  → user receives LICN spores
```

**New system** (wrapped asset minting via `submit_wrapped_credit()`):
```
credit_worker_loop → submit_wrapped_credit()
  → determines target contract from CreditJob.source_asset:

      ┌─────────────────┬────────────────────────────────────┐
      │ Deposited Asset  │ Credit Action                      │
      ├─────────────────┼────────────────────────────────────┤
      │ USDT             │ lusd_token::mint(user, amount)     │
      │ USDC             │ lusd_token::mint(user, amount)     │
      │ SOL              │ wsol_token::mint(user, amount)     │
      │ ETH              │ weth_token::mint(user, amount)     │
      └─────────────────┴────────────────────────────────────┘

  → builds contract Call instruction via build_contract_mint_instruction()
  → submits to Lichen RPC
  → user receives wrapped token on Lichen
```

**Conversion**: 1:1 raw units. 500 USDC (6 decimals) = 500,000,000 micro-lUSD. 1.5 SOL (9 decimals) = 1,500,000,000 lamport-wSOL. No price conversion, no oracle needed at deposit time.

### Step 6: User Trades on DEX

Now the user has wrapped tokens and can trade any pair:

```
User received 500 lUSD from USDC deposit
  → buys LICN/lUSD at market price
  → user now holds LICN

User received 2.0 wSOL from SOL deposit
  → can sell wSOL/lUSD to get lUSD (USD equivalent)
  → can sell wSOL/LICN to get LICN directly (no stablecoin involved)
  → can hold wSOL and trade later

User received 0.5 wETH from ETH deposit
  → can trade wETH/lUSD or wETH/LICN
```

### Step 7: Withdrawal (Reverse)

```
User wants to withdraw 1.0 wSOL back to real SOL

1. User calls:  POST /withdrawals { user_id, asset: "wSOL", amount: 1_000_000_000, dest_chain: "solana", dest_address }
   → Custody creates WithdrawalJob with status "pending_burn"

2. User calls wsol_token::burn(1_000_000_000)    [1.0 SOL in spores]
   → on-chain: balance deducted, total_supply reduced, BURN event logged

3. Custody Service — withdrawal_worker_loop
   → Phase 1 (pending_burn): verifies burn tx confirmed on Lichen → status "burned"
     → Phase 2 (burned): chooses the treasury signing mode → status "signing"
     → Phase 3 (signing): broadcasts outbound transaction → status "broadcasting"
       • SOL: system transfer from treasury → user's Solana address
       • ETH: raw ETH transfer from treasury → user's Ethereum address
       • USDT: SPL/ERC-20 transfer from treasury → user's address
       • Solana treasury spends use FROST when signer quorum is configured
       • EVM treasury spends use Safe-owner signatures over a pinned Safe intent hash plus a coordinator-submitted executor tx when signer quorum is configured
   → Phase 4 (broadcasting): confirms on dest chain → status "confirmed"

4. User receives 1.0 SOL on Solana

Same flow for lUSD → USDT/USDC, wETH → ETH.
For lUSD withdrawals, user specifies preference: "I want USDT on Solana" or "USDC on Ethereum".
```

---

## Trading Pairs (All Markets)

### lUSD Quote Pairs (priced in USD)

| Pair | Description | Fee Tier |
|------|-------------|----------|
| LICN/lUSD | Core pair — LICN price in USD | 0.30% |
| wSOL/lUSD | SOL price in USD | 0.30% |
| wETH/lUSD | ETH price in USD | 0.05% |
| MOSS/lUSD | MOSS ecosystem token | 1.00% |

### LICN Quote Pairs (priced in LICN)

| Pair | Description | Fee Tier |
|------|-------------|----------|
| wSOL/LICN | SOL ↔ LICN direct | 0.30% |
| wETH/LICN | ETH ↔ LICN direct | 0.30% |
| MOSS/LICN | MOSS ↔ LICN ecosystem | 1.00% |

### Stable Pair (deprecated — no longer needed)

The old `USDT/USDC` pool is replaced by lUSD. Since both USDT and USDC produce lUSD, there's no need for a stablecoin swap pool on Lichen DEX.

---

## What Changed in the Custody Service

### Changed: `submit_licn_credit()` → `submit_wrapped_credit()`

The credit worker previously built a system transfer (opcode 0) to send native LICN. It now builds a contract Call instruction targeting the appropriate wrapped token contract.

```
Changes in custody/src/main.rs:

1. CreditJob struct: added source_asset and source_chain fields
2. CustodyConfig: added musd_contract_addr, wsol_contract_addr, weth_contract_addr
3. build_credit_job(): carries asset/chain from deposit request to CreditJob
4. resolve_token_contract(): maps deposited asset to contract address:
     "usdt" | "usdc" → CUSTODY_LUSD_TOKEN_ADDR
     "sol"           → CUSTODY_WSOL_TOKEN_ADDR
     "eth"           → CUSTODY_WETH_TOKEN_ADDR
5. build_contract_mint_instruction(): builds Call instruction with mint(caller, to, amount)
6. submit_wrapped_credit(): orchestrates the full mint flow
7. New env vars: CUSTODY_LUSD_TOKEN_ADDR, CUSTODY_WSOL_TOKEN_ADDR, CUSTODY_WETH_TOKEN_ADDR
```

### New: Withdrawal endpoint + worker loop

```
New additions:

1. POST /withdrawals endpoint (create_withdrawal):
   - Validates asset + dest_chain combination
   - Creates WithdrawalJob in CF_WITHDRAWAL_JOBS column family

2. withdrawal_worker_loop (5th async loop):
   - 4-phase state machine: pending_burn → burned → signing → broadcasting → confirmed
   - Phase 1: Verify burn tx on Lichen
  - Phase 2: Use the active treasury signing mode: self-custody, Solana FROST, or EVM Safe
   - Phase 3: Broadcast outbound tx on destination chain
   - Phase 4: Confirm on destination chain

3. Supporting functions:
   - store_withdrawal_job(), list_withdrawal_jobs_by_status()
   - broadcast_outbound_withdrawal()
   - assemble_signed_solana_tx(), assemble_signed_evm_tx()
   - check_solana_tx_confirmed(), check_evm_tx_confirmed()
```

### Unchanged

Everything else stays exactly as-is:
- Deposit address generation (`POST /deposits`)
- Chain watcher loops (solana_watcher_loop, evm_watcher_loop)
- Sweep worker loop (local sweep signing, transaction broadcasting)
- RocksDB storage layer
- HD address derivation
- ATA creation for SPL tokens

---

## Contracts

| Contract | Based On | Key Differences |
|----------|----------|-----------------|
| `lusd_token` | Original (888 lines) | Name="Lichen USD", Symbol="lUSD", Decimals=6, 100K lUSD/epoch cap |
| `wsol_token` | `lusd_token` | Name="Wrapped SOL", Symbol="wSOL", Decimals=9, 50K SOL/epoch cap |
| `weth_token` | `lusd_token` | Name="Wrapped ETH", Symbol="wETH", Decimals=18, 500 ETH/epoch cap |

All three share identical security model: mint/burn/transfer/approve, reentrancy guard, pause, 3-of-5 multisig admin, reserve attestation with proof hashes, circuit breaker, epoch rate limiting, full audit trail.

> **Future optimization**: Deploy a single `wrapped_token` contract with configurable metadata passed at `initialize()`. This avoids duplicating 500+ lines of identical logic. Each asset would be a separate deployment of the same contract with different init parameters.

---

## Post-Genesis Deployment

Run `tools/deploy_dex.py` on a live validator after genesis:

```
Phase 1 — Deploy wrapped token contracts (lusd_token, wsol_token, weth_token)
Phase 2 — Deploy DEX core (dex_core, dex_amm, dex_router)
Phase 3 — Deploy DEX modules (dex_margin, dex_rewards, dex_governance, dex_analytics)

Each contract is: deployed → initialized with admin → cross-referenced

Output: deploy-manifest.json with all contract addresses
```

Then configure the custody service:
```bash
export CUSTODY_LUSD_TOKEN_ADDR=<lusd_token address from manifest>
export CUSTODY_WSOL_TOKEN_ADDR=<wsol_token address from manifest>
export CUSTODY_WETH_TOKEN_ADDR=<weth_token address from manifest>
```

---

## Custody Model Summary

```
┌──────────────────────────────────────────────────────────────┐
│                    TRUST BOUNDARY                             │
│  (Custodial: treasury withdrawals are threshold-protected,     │
│   while deposit sweeps stay locally signed unless explicitly   │
│   allowed in multi-signer mode)                                │
│                                                               │
│  USDT ──┐                                                     │
│  USDC ──┤── Treasury Solana wallet (SPL ATAs)                 │
│  SOL  ──┘                                                     │
│                                                               │
│  ETH  ──┐                                                     │
│  USDT ──┤── Treasury Ethereum wallet (EOA)                    │
│  USDC ──┘                                                     │
│                                                               │
│  Protection: 3-of-5 multisig, reserve attestation,            │
│              circuit breaker, epoch rate limits, audit trail   │
└──────────────────────────────────────────────────────────────┘
                            │
                     mint() / burn()
                            │
┌──────────────────────────────────────────────────────────────┐
│                  SELF-CUSTODIAL LAYER                          │
│  (Lichen — smart contracts hold all funds)                 │
│                                                               │
│  lUSD, wSOL, wETH tokens                                     │
│       │                                                       │
│       ├── User wallets (user holds their tokens)              │
│       ├── dex_core (order book funds)                         │
│       ├── dex_amm (pool liquidity)                            │
│       ├── dex_margin (collateral)                             │
│       └── sporevault (yield vaults)                            │
│                                                               │
│  No operator can move these funds outside contract rules.     │
└──────────────────────────────────────────────────────────────┘
```

---

## Contract Count Update

| Category | Contracts | Count |
|----------|-----------|-------|
| Core (existing) | licn_token, lichenbridge, lichenrpc, lichendns, lichenoracle, licnid, lichendao, lichenmail, lichenstake, sporeback, sporevault, lichenswap, lichenmedia, sporelock, lockmax, mosstoken | 16 |
| DEX | dex_core, dex_amm, dex_router, dex_governance, dex_rewards, dex_margin, dex_analytics | 7 |
| Wrapped Assets (new) | lusd_token, wsol_token, weth_token | 3 |
| **Total** | | **26** |
