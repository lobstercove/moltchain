# MoltChain Custody Service — Deployment Guide

> Everything you need to know to deploy and operate the custody bridge on a VPS.

> Production readiness note: deposit sweeps still broadcast from locally derived deposit keys, so multi-signer deposit issuance and local-sweep execution remain hard-disabled until deposit sweeps have a real threshold architecture. Solana treasury withdrawals for native SOL and SPL stablecoins use the live FROST coordinator, and EVM treasury withdrawals use Safe-owner signatures plus a coordinator-submitted executor transaction.

---

## Architecture Overview

The custody service is a standalone Rust binary (`custody`) that bridges assets between external chains (Solana, Ethereum) and MoltChain. It runs on **port 9105** and uses a local RocksDB database.

```
┌──────────────────────────────────────────────────────────────────────┐
│  SEED / RELAY VPS                                                    │
│                                                                      │
│  ┌────────────┐   ┌──────────────┐   ┌──────────────────────────┐   │
│  │ Validator   │   │ RPC Server   │   │ Custody Service          │   │
│  │  :8000      │   │  :8899       │   │  :9105                   │   │
│  │             │   │  WS :8899/ws │   │  RocksDB: ./data/custody │   │
│  │  ┌────────┐│   │              │   │                          │   │
│  │  │Threshold││   │              │   │  7 background workers    │   │
│  │  │Signer  ││   │              │   │  13 column families      │   │
│  │  │ :9200  ││   │              │   │                          │   │
│  │  └────────┘│   │              │   │                          │   │
│  └────────────┘   └──────────────┘   └──────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘

┌────────────────────┐   ┌────────────────────┐
│ Validator 2 VPS    │   │ Validator 3 VPS    │
│  Validator  :8000  │   │  Validator  :8000  │
│  Threshold  :9200  │   │  Threshold  :9200  │
│  Signer            │   │  Signer            │
└────────────────────┘   └────────────────────┘
```

**Current trust model:** deposit sweeps still use locally derived deposit keys, while treasury withdrawals now have live threshold paths on Solana and EVM. Multi-signer deployment is supported, but the end-to-end bridge flow still stops short of one complete production-grade threshold model because the sweep boundary is not threshold-controlled yet.

---

## How It Works

### Deposit Flow (External → MoltChain)

```
User deposits SOL/ETH/USDT/USDC to a generated address
        │
        ▼
1. Wallet calls POST /deposits → custody returns unique deposit address
2. Solana/EVM watcher polls for incoming funds at that address
3. Once confirmed (1 Solana confirmation / 12 EVM confirmations):
   a. deposit_event recorded
   b. deposit status → "confirmed"
   c. SweepJob created (move funds from deposit address → treasury)
4. Sweep worker transitions the job to `signing`, then promotes it as locally signed because deposit sweeps still broadcast with the derived deposit key rather than a threshold signer quorum
5. Custody broadcasts the sweep tx on the source chain using the locally derived deposit key and records the sweep as locally signed in the audit event stream
6. After sweep confirmed → CreditJob created
7. Credit worker mints wrapped tokens (mUSD/wSOL/wETH) on MoltChain
8. Reserve ledger updated for stablecoin deposits
```

### Withdrawal Flow (MoltChain → External)

```
User burns wrapped tokens on MoltChain
        │
        ▼
1. Wallet calls POST /withdrawals (includes burn_tx_signature)
2. Withdrawal worker verifies burn tx on MoltChain via RPC
3. Once burn confirmed → route the outbound treasury spend through the chain-specific signing mode
4. Solana treasury withdrawals for SOL, USDT, and USDC use the FROST coordinator; EVM treasury withdrawals use Safe-owner signatures over the pinned Safe transaction hash plus a coordinator-submitted executor tx; self-custody mode still signs directly when no signer quorum is configured
5. Confirm on destination chain
6. Reserve ledger decremented for stablecoin withdrawals
```

### Wrapped Token Contracts

| External Asset | MoltChain Wrapped Token | Env Var |
|---|---|---|
| USDT / USDC (Solana or ETH) | mUSD | `CUSTODY_MUSD_TOKEN_ADDR` |
| SOL | wSOL | `CUSTODY_WSOL_TOKEN_ADDR` |
| ETH | wETH | `CUSTODY_WETH_TOKEN_ADDR` |

These are MoltChain smart contract addresses. The custody service calls `mint()` on them when crediting deposits and expects the wallet to `burn()` them for withdrawals.

---

## Background Workers (7 total)

| Worker | Function | Frequency |
|---|---|---|
| `solana_watcher_loop` | Polls Solana for deposit confirmations | Every `poll_interval_secs` (default 15s) |
| `evm_watcher_loop` | Polls Ethereum for deposit confirmations | Every `poll_interval_secs` |
| `sweep_worker_loop` | Promotes sweeps to the live local-signing path, broadcasts sweep txs, and confirms them | Every `poll_interval_secs` |
| `credit_worker_loop` | Mints wrapped tokens on MoltChain | Every `poll_interval_secs` |
| `withdrawal_worker_loop` | Processes burn → outbound withdrawal | Every `poll_interval_secs` |
| `rebalance_worker_loop` | Maintains USDT/USDC reserve ratio | Every `poll_interval_secs × 20` (~5 min) |
| `deposit_cleanup_loop` | Prunes expired unfunded deposit addresses | Every 10 min |

---

## RocksDB Column Families (13 total)

| Column Family | Purpose |
|---|---|
| `deposits` | Deposit request records (status: issued → confirmed → swept) |
| `indexes` | Next deposit index per user/chain/asset |
| `address_index` | Address → deposit_id reverse lookup |
| `deposit_events` | On-chain confirmation events for deposits |
| `sweep_jobs` | Sweep pipeline: queued → signing → signed → sweep_submitted → sweep_confirmed |
| `address_balances` | Native balance cache for deposit addresses |
| `token_balances` | SPL/ERC20 balance cache for deposit addresses |
| `credit_jobs` | MoltChain mint pipeline: queued → submitted → confirmed |
| `withdrawal_jobs` | Withdrawal pipeline: pending_burn → burned → signing → broadcasting → confirmed |
| `audit_events` | Full audit trail of every state transition |
| `cursors` | Chain polling cursors (last processed slot/block) |
| `reserve_ledger` | Treasury reserve balances per chain+asset |
| `rebalance_jobs` | USDT↔USDC swap jobs: queued → submitted → confirmed |

---

## Signer Coordination

The custody binary now has live threshold treasury-signing paths, but the full deposit-to-withdrawal bridge still is not end-to-end threshold-controlled because deposit sweeps remain locally signed.

Current behavior:

1. Deposit sweeps transition through `queued` and `signing`, then are marked as locally signed and broadcast with the derived deposit key.
2. Treasury withdrawals use self-custody signing when no signer quorum is configured.
3. With signer endpoints plus threshold configuration, Solana treasury withdrawals use FROST and EVM treasury withdrawals use Safe-owner signatures plus a coordinator-submitted executor tx.
4. Unsupported threshold routes fail closed instead of silently falling back to a misleading generic signer path.

Multi-signer note:

- the binary contains one live threshold Solana treasury withdrawal path today for both native SOL and SPL stablecoins through the FROST coordinator,
- the binary also contains one live threshold EVM treasury withdrawal path today: Safe-owner signatures over the exact Safe transaction hash, followed by a coordinator-submitted `execTransaction` relay tx,
- deposit sweeps still sign locally from derived deposit keys,
- treat the threshold formula below as the operator target architecture, not as proof that every chain path is production-complete today.

### Target Threshold Formula

| Number of Signers | Required Signatures |
|---|---|
| 1–2 | 1 |
| 3–4 | 2 |
| 5+ | 3 |

Override with `CUSTODY_SIGNER_THRESHOLD` env var when you need a threshold different from the default formula.

### SignerRequest Payload

```json
{
  "job_id": "uuid",
  "chain": "solana",
  "asset": "usdt",
  "from_address": "deposit-address",
  "to_address": "treasury-address",
  "amount": "1000000",
  "tx_hash": "source-chain-tx-hash"
}
```

---

## Environment Variables — Full Reference

### Required for Current Production-Safe Deployments

| Variable | Description | Example |
|---|---|---|
| `CUSTODY_MOLT_RPC_URL` | MoltChain RPC endpoint | `http://localhost:8899` |
| `CUSTODY_TREASURY_KEYPAIR` | Path to MoltChain treasury keypair (JSON) | `/etc/moltchain/treasury.json` |
| `CUSTODY_MUSD_TOKEN_ADDR` | mUSD wrapped token contract on MoltChain | `<base58 address>` |
| `CUSTODY_WSOL_TOKEN_ADDR` | wSOL wrapped token contract on MoltChain | `<base58 address>` |
| `CUSTODY_WETH_TOKEN_ADDR` | wETH wrapped token contract on MoltChain | `<base58 address>` |
| `CUSTODY_SIGNER_ENDPOINTS` | Comma-separated signer URLs. Use one endpoint for the single-signer operating model, or a signer quorum when enabling threshold treasury withdrawals. | `http://10.0.0.2:9200` |

### Solana Bridge

| Variable | Description | Default |
|---|---|---|
| `CUSTODY_SOLANA_RPC_URL` | Solana RPC endpoint | *(disabled if unset)* |
| `CUSTODY_TREASURY_SOLANA` | Solana treasury wallet address | *(required for Solana bridge)* |
| `CUSTODY_SOLANA_FEE_PAYER` | Path to Solana fee payer keypair JSON (64-byte array) | *(required for Solana bridge)* |
| `CUSTODY_SOLANA_TREASURY_OWNER` | ATA owner for Solana treasury (defaults to `CUSTODY_TREASURY_SOLANA`) | — |
| `CUSTODY_SOLANA_USDC_MINT` | Solana USDC mint address | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| `CUSTODY_SOLANA_USDT_MINT` | Solana USDT mint address | `Es9vMFrzaCER3FXvxuauYhVNiVw9g8Y3V9D2n7sGdG8d` |
| `CUSTODY_SOLANA_CONFIRMATIONS` | Confirmations needed before processing | `1` |

### Ethereum Bridge

| Variable | Description | Default |
|---|---|---|
| `CUSTODY_EVM_RPC_URL` | Ethereum RPC endpoint | *(disabled if unset)* |
| `CUSTODY_TREASURY_EVM` | Ethereum treasury wallet address | *(required for ETH bridge)* |
| `CUSTODY_EVM_USDC` | Ethereum USDC contract | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| `CUSTODY_EVM_USDT` | Ethereum USDT contract | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |
| `CUSTODY_EVM_CONFIRMATIONS` | Block confirmations needed | `12` |

### Signing & Threshold

| Variable | Description | Default |
|---|---|---|
| `CUSTODY_SIGNER_ENDPOINTS` | Comma-separated signer URLs for treasury withdrawal signing. Sweeps remain locally signed even when this is populated. | *(empty = self-custody signing)* |
| `CUSTODY_SIGNER_THRESHOLD` | Override required signer shares for threshold treasury withdrawals | *(auto: see formula above)* |

### Service Tuning

| Variable | Description | Default |
|---|---|---|
| `CUSTODY_DB_PATH` | RocksDB data directory | `./data/custody` |
| `CUSTODY_POLL_INTERVAL_SECS` | Watcher/worker poll interval | `15` |
| `CUSTODY_DEPOSIT_TTL_SECS` | Expire unfunded deposits after (seconds) | `86400` (24h) |

### Reserve Rebalancing

| Variable | Description | Default |
|---|---|---|
| `CUSTODY_REBALANCE_THRESHOLD_BPS` | Trigger rebalance when one side exceeds (bps) | `7000` (70%) |
| `CUSTODY_REBALANCE_TARGET_BPS` | Swap to reach this ratio (bps) | `5000` (50/50) |
| `CUSTODY_JUPITER_API_URL` | Jupiter aggregator URL for Solana USDT↔USDC swaps | *(disabled if unset)* |
| `CUSTODY_UNISWAP_ROUTER` | Uniswap router address for ETH USDT↔USDC swaps | *(disabled if unset)* |

---

## HTTP API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Returns `{"status": "ok"}` |
| GET | `/status` | Signer count, threshold, sweep/credit job counts |
| POST | `/deposits` | Create deposit address → returns `{deposit_id, address}` (Bearer auth required) |
| GET | `/deposits/:deposit_id` | Get deposit status |
| POST | `/withdrawals` | Initiate withdrawal job after client-side burn preparation (Bearer auth required) |
| PUT | `/withdrawals/:job_id/burn` | Submit or replace an unverified burn tx signature to advance `pending_burn` jobs (Bearer auth required) |
| GET | `/reserves` | Current reserve balances per chain/asset |
| POST | `/webhooks` | Register webhook endpoint with HMAC-SHA256 signing secret (Bearer auth required) |
| GET | `/webhooks` | List webhook configurations (secrets redacted) |
| DELETE | `/webhooks/:id` | Remove webhook subscription |
| GET | `/ws/events` | Real-time event stream (Bearer auth via `?token=`, optional `?filter=`) |
| GET | `/events` | Paginated custody event history |

### Webhook Registration

```json
POST /webhooks
{
  "url": "https://your-agent.example/webhook/custody",
  "secret": "<hmac-shared-secret>",
  "events": ["deposit.confirmed", "credit.confirmed", "withdrawal.confirmed"]
}
```

Notes:

- webhook payloads are signed with HMAC-SHA256
- delivery retries: 3 attempts with exponential backoff
- webhook secrets are redacted from list responses

### WebSocket Event Stream

```text
GET /ws/events?token=<bearer_token>&filter=deposit.confirmed,credit.confirmed
```

Notes:

- supports keepalive for long-running clients
- `filter` narrows stream to selected event types (comma-separated)

### Event History

```text
GET /events?page=1&limit=100
```

Use this endpoint for replay/recovery when webhook or WS consumers were offline.

### Event Types (wired)

Deposits:

- `deposit.created`
- `deposit.confirmed`
- `deposit.expired`

Sweeps:

- `sweep.signing`
- `sweep.signed`
- `sweep.submitted`
- `sweep.failed`
- `sweep.confirmed`

Credits:

- `credit.queued`
- `credit.build_failed`
- `credit.submitted`
- `credit.confirmed`

Withdrawals:

- `withdrawal.requested`
- `withdrawal.burn_submitted`
- `withdrawal.burn_confirmed`
- `withdrawal.signatures_collected`
- `withdrawal.broadcast`
- `withdrawal.confirmed`
- `withdrawal.permanently_failed`

Rebalancing:

- `rebalance.submitted`
- `rebalance.confirmed`
- `rebalance.slippage_exceeded`
- `rebalance.output_unverified`

### Create Deposit Request

```json
POST /deposits
{
  "user_id": "<moltchain-pubkey>",
  "chain": "solana",
  "asset": "usdt"
}
```

Response:
```json
{
  "deposit_id": "uuid",
  "address": "solana-deposit-address"
}
```

### Create Withdrawal Request

```json
POST /withdrawals
{
  "user_id": "<moltchain-pubkey>",
  "asset": "mUSD",
  "amount": 1000000,
  "dest_chain": "solana",
  "dest_address": "<solana-address>",
  "preferred_stablecoin": "usdt"
}
```

Header:

```text
Authorization: Bearer <CUSTODY_API_AUTH_TOKEN>
```

### Submit Burn Signature (required for withdrawal finalization)

```json
PUT /withdrawals/:job_id/burn
{
  "burn_tx_signature": "<moltchain-burn-tx-signature>"
}
```

Header:

```text
Authorization: Bearer <CUSTODY_API_AUTH_TOKEN>
```

Notes:

- The burn signature must still match the expected contract, caller, method, and amount on-chain.
- If verification fails while the job is still in `pending_burn`, the service clears the bad signature and allows a corrected resubmission.
- Re-submitting the same signature is idempotent.

Response:

```json
{
  "job_id": "<job_id>",
  "status": "pending_burn",
  "burn_tx_signature": "<moltchain-burn-tx-signature>",
  "message": "Burn signature recorded. Verification will proceed automatically."
}
```

---

## VPS Setup Checklist

### 1. Build the Binary

```bash
cd moltchain
cargo build --release -p moltchain-custody
# Binary: target/release/moltchain-custody
```

### 2. Create Treasury Keypair

This is the MoltChain keypair the custody service uses to sign `mint()` calls on wrapped token contracts.

```bash
# Generate and fund this on MoltChain
# Store as JSON: [secret_key_bytes...]
# Example path: /etc/moltchain/treasury-keypair.json
```

### 3. Create Solana Fee Payer Keypair

This Solana keypair pays for ATA creation and sweep transaction fees.

```bash
# Standard Solana CLI keypair format: [64 bytes as JSON array]
# Example path: /etc/moltchain/solana-fee-payer.json
# Fund with ~1 SOL for gas
```

### 4. Deploy Wrapped Token Contracts on MoltChain

Before custody can mint, you need the three wrapped token contracts deployed:
- **mUSD** — unified stablecoin (backs both USDT and USDC deposits)
- **wSOL** — wrapped SOL
- **wETH** — wrapped ETH

Set their addresses in env vars.

### 5. Create the systemd Service

```ini
# /etc/systemd/system/moltchain-custody.service
[Unit]
Description=MoltChain Custody Bridge
After=network-online.target moltchain-validator.service
Wants=network-online.target

[Service]
Type=simple
User=moltchain
Group=moltchain
WorkingDirectory=/opt/moltchain
ExecStart=/opt/moltchain/bin/moltchain-custody
Restart=always
RestartSec=5

# === Core ===
Environment=CUSTODY_DB_PATH=/var/lib/moltchain/custody-db
Environment=CUSTODY_POLL_INTERVAL_SECS=15
Environment=CUSTODY_DEPOSIT_TTL_SECS=86400
Environment=RUST_LOG=info

# === MoltChain ===
Environment=CUSTODY_MOLT_RPC_URL=http://127.0.0.1:8899
# CRITICAL: This keypair MUST be the same one that deployed + initialized the
# wrapped token contracts (the "admin" key). Otherwise mint() returns error 2.
# After running deploy_dex.py, copy keypairs/deployer.json here:
Environment=CUSTODY_TREASURY_KEYPAIR=/etc/moltchain/custody-treasury-testnet.json

# === Wrapped Token Contracts ===
# These are auto-discovered from the symbol registry, but can be pinned:
Environment=CUSTODY_MUSD_TOKEN_ADDR=<deploy-and-fill>
Environment=CUSTODY_WSOL_TOKEN_ADDR=<deploy-and-fill>
Environment=CUSTODY_WETH_TOKEN_ADDR=<deploy-and-fill>
Environment=CUSTODY_WBNB_TOKEN_ADDR=<deploy-and-fill>

# === Solana Bridge ===
Environment=CUSTODY_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
Environment=CUSTODY_TREASURY_SOLANA=<your-solana-treasury-address>
Environment=CUSTODY_SOLANA_FEE_PAYER=/etc/moltchain/solana-fee-payer.json
Environment=CUSTODY_SOLANA_CONFIRMATIONS=1

# === Ethereum Bridge (add when ready) ===
# Environment=CUSTODY_EVM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/<key>
# Environment=CUSTODY_TREASURY_EVM=0x...
# Environment=CUSTODY_EVM_CONFIRMATIONS=12

# === Threshold Signers ===
Environment=CUSTODY_SIGNER_ENDPOINTS=http://10.0.0.2:9200,http://10.0.0.3:9200
# Environment=CUSTODY_SIGNER_THRESHOLD=2  # auto-calculated if omitted

# === Reserve Rebalance (optional) ===
# Environment=CUSTODY_REBALANCE_THRESHOLD_BPS=7000
# Environment=CUSTODY_REBALANCE_TARGET_BPS=5000
# Environment=CUSTODY_JUPITER_API_URL=https://quote-api.jup.ag/v6

[Install]
WantedBy=multi-user.target
```

### 6. Configure Validator Threshold Signers (on each validator VPS)

> Current live behavior: threshold signers are used for treasury withdrawal paths, but multi-signer deposit issuance remains fail-closed.
> Do not expect `POST /deposits` to succeed in threshold mode until custody grows a threshold-safe deposit issuance flow.

Each validator runs a threshold signer sidecar as part of its binary. Configure:

```bash
# On validator 2 VPS:
# The signer listens on port 9200 by default
# It needs its own Ed25519 keypair for signing
# Auth token must match what custody expects
```

The custody service reaches the signers via their private network IPs (the `CUSTODY_SIGNER_ENDPOINTS` list). These should NOT be exposed to the public internet — use a private VLAN or WireGuard tunnel between VPS nodes.

### 7. DNS & Reverse Proxy

```
custody.moltchain.network  →  VPS:9105  (HTTPS via nginx/caddy)
```

The wallet connects to custody via the `CUSTODY_ENDPOINTS` config:
```javascript
const CUSTODY_ENDPOINTS = {
    'mainnet': 'https://custody.moltchain.network',
    'testnet': 'https://testnet-custody.moltchain.network',
    'local-testnet': 'http://localhost:9105',
};
```

### 8. Enable & Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable moltchain-custody
sudo systemctl start moltchain-custody
sudo journalctl -u moltchain-custody -f
```

### 9. Verify

```bash
# Health check
curl http://localhost:9105/health
# → {"status":"ok"}

# Status check (signers, job counts)
curl http://localhost:9105/status
# → {"signers":{"configured":2,"threshold":2},"sweeps":{...},"credits":{...}}

# Test deposit creation
# In threshold-signing mode this currently returns a fail-closed error by design.
curl -X POST http://localhost:9105/deposits \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<moltchain-pubkey>","chain":"solana","asset":"usdt"}'
```

---

## Security Considerations

1. **Signer endpoints must be on a private network.** Use WireGuard or a VPC private subnet. Never expose port 9200 publicly.
2. **Treasury keypair** is the most sensitive file — it can mint wrapped tokens. Restrict file permissions: `chmod 600`.
3. **Solana fee payer keypair** only needs enough SOL for gas (~1 SOL). Don't overfund.
4. **The custody HTTP API (port 9105)** should be behind HTTPS in production. Use Caddy or nginx with Let's Encrypt.
5. **Audit events** are stored in the `audit_events` column family — every state transition is logged. Back up the RocksDB directory regularly.
6. **Deposit TTL** (default 24h) automatically cleans up unfunded deposit addresses and their associated balance/index entries.

---

## Monitoring

Things to watch:

| Metric | How to Check |
|---|---|
| Service alive | `GET /health` — should return `{"status":"ok"}` |
| Signer connectivity | `GET /status` → `signers.configured` should match your validator count |
| Stuck sweeps | `GET /status` → `sweeps.by_status` — watch for growing "signing" or "queued" counts |
| Stuck credits | `GET /status` → `credits.by_status` — watch for growing "queued" counts |
| RocksDB size | `du -sh /var/lib/moltchain/custody-db` |
| Logs | `journalctl -u moltchain-custody --since "1 hour ago"` — look for `warn` entries |

---

## Startup Order

1. **Validator** (port 8000) — starts first, includes threshold signer on 9200
2. **RPC** (port 8899) — needs validator running
3. **Custody** (port 9105) — needs RPC + validator signers online for supported threshold treasury flows; threshold-mode deposits remain disabled today

If Solana/EVM RPC URLs are unset, those watchers simply don't start. You can enable Solana-only bridging first and add Ethereum later by setting `CUSTODY_EVM_RPC_URL`.

---

## Deposit Address Derivation

Addresses are deterministic: `molt/{chain}/{asset}/{user_id}/{index}`

- **Solana native (SOL):** Derives an Ed25519 pubkey from the path
- **Solana SPL tokens (USDT/USDC):** Derives an owner pubkey, then computes the Associated Token Account (ATA). If the ATA doesn't exist, custody creates it using the fee payer.
- **Ethereum:** Derives a secp256k1 address from the path

Each user+chain+asset combination gets incrementing indexes (0, 1, 2, ...) so they can request multiple deposit addresses.
