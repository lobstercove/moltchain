# MoltChain — Agent Skill Book

> Comprehensive reference for autonomous agents operating on MoltChain.
> Every contract, RPC method, CLI command, and operational procedure documented here.

---

## Quick Reference

| Property | Value |
|----------|-------|
| Chain | MoltChain (custom L1) |
| Consensus | Proof of Stake with contributory stake |
| Slot time | 400 ms |
| Native token | MOLT (1 MOLT = 1 000 000 000 shells) |
| Signing | Ed25519 |
| Smart contracts | WASM (Rust → wasm32-unknown-unknown) |
| RPC | JSON-RPC 2.0 on port 8899 |
| WebSocket | Port 8900 |
| Explorer | Port 3001 |
| DEX | Port 8080 |
| Wallet | Port 3000 |
| Faucet | Port 9900 |

---

## Contract Surface

All 28 deployed smart contracts with their exported functions:

- `bountyboard`: Decentralized bounty marketplace. Exports: `create_bounty`, `submit_work`, `approve_work`, `cancel_bounty`, `get_bounty`, `set_identity_admin`, `set_moltyid_address`, `set_identity_gate`, `set_token_address`, `initialize`, `approve_submission`, `get_bounty_count`, `set_platform_fee`, `bb_pause`, `bb_unpause`, `get_platform_stats`

- `clawpay`: Token streaming / vesting protocol. Exports: `create_stream`, `withdraw_from_stream`, `cancel_stream`, `get_stream`, `get_withdrawable`, `create_stream_with_cliff`, `transfer_stream`, `initialize_cp_admin`, `set_token_address`, `set_self_address`, `pause`, `unpause`, `get_stream_info`, `set_identity_admin`, `set_moltyid_address`, `set_identity_gate`, `get_stream_count`, `get_platform_stats`

- `clawpump`: Token launchpad with bonding curves and DEX graduation. Exports: `initialize`, `create_token`, `buy`, `sell`, `get_token_info`, `get_buy_quote`, `get_token_count`, `get_platform_stats`, `pause`, `unpause`, `freeze_token`, `unfreeze_token`, `set_buy_cooldown`, `set_sell_cooldown`, `set_max_buy`, `set_creator_royalty`, `withdraw_fees`, `set_molt_token`, `set_dex_addresses`, `get_graduation_info`

- `clawvault`: Yield vault with multi-strategy allocation. Exports: `initialize`, `add_strategy`, `deposit`, `withdraw`, `set_protocol_addresses`, `set_molt_token`, `harvest`, `get_vault_stats`, `get_user_position`, `get_strategy_info`, `cv_pause`, `cv_unpause`, `set_deposit_fee`, `set_withdrawal_fee`, `set_deposit_cap`, `set_risk_tier`, `remove_strategy`, `withdraw_protocol_fees`, `update_strategy_allocation`

- `compute_market`: Decentralized compute job marketplace. Exports: `register_provider`, `submit_job`, `claim_job`, `complete_job`, `dispute_job`, `get_job`, `initialize`, `set_claim_timeout`, `set_complete_timeout`, `set_challenge_period`, `add_arbitrator`, `remove_arbitrator`, `set_token_address`, `cancel_job`, `release_payment`, `resolve_dispute`, `deactivate_provider`, `reactivate_provider`, `update_provider`, `get_escrow`, `set_identity_admin`, `set_moltyid_address`, `set_identity_gate`, `create_job`, `accept_job`, `submit_result`, `confirm_result`, `get_job_info`, `get_job_count`, `get_provider_info`, `set_platform_fee`, `cm_pause`, `cm_unpause`, `get_platform_stats`

- `dex_amm`: Automated market maker pools for the DEX. Exports: `initialize`, `call`

- `dex_analytics`: On-chain DEX analytics aggregation. Exports: `initialize`, `call`

- `dex_core`: Central limit order book (CLOB) matching engine. Exports: `initialize`, `call`

- `dex_governance`: DEX governance proposals and voting. Exports: `initialize`, `call`

- `dex_margin`: Cross-margin trading engine. Exports: `call`

- `dex_rewards`: Trading rewards and fee distribution. Exports: `initialize`, `call`

- `dex_router`: Smart order routing across AMM and CLOB. Exports: `call`

- `lobsterlend`: Lending and borrowing protocol with flash loans. Exports: `initialize`, `deposit`, `withdraw`, `borrow`, `repay`, `liquidate`, `get_account_info`, `get_protocol_stats`, `flash_borrow`, `flash_repay`, `pause`, `unpause`, `set_deposit_cap`, `set_reserve_factor`, `withdraw_reserves`, `set_moltcoin_address`, `get_interest_rate`, `get_deposit_count`, `get_borrow_count`, `get_liquidation_count`, `get_platform_stats`

- `moltauction`: NFT auction house with royalties. Exports: `create_auction`, `place_bid`, `finalize_auction`, `make_offer`, `accept_offer`, `set_royalty`, `update_collection_stats`, `get_collection_stats`, `initialize`, `set_reserve_price`, `cancel_auction`, `initialize_ma_admin`, `ma_pause`, `ma_unpause`, `get_auction_info`, `get_auction_stats`

- `moltbridge`: Cross-chain bridge with multi-validator consensus. Exports: `initialize`, `add_bridge_validator`, `remove_bridge_validator`, `set_required_confirmations`, `set_request_timeout`, `lock_tokens`, `submit_mint`, `confirm_mint`, `submit_unlock`, `confirm_unlock`, `cancel_expired_request`, `get_bridge_status`, `has_confirmed_mint`, `has_confirmed_unlock`, `is_source_tx_used`, `is_burn_proof_used`, `set_moltyid_address`, `set_identity_gate`, `set_token_address`, `mb_pause`, `mb_unpause`

- `moltcoin`: Native MOLT token (SPL-like). Exports: `initialize`, `balance_of`, `transfer`, `mint`, `burn`, `approve`, `transfer_from`, `total_supply`

- `moltdao`: On-chain governance with treasury. Exports: `initialize_dao`, `create_proposal`, `create_proposal_typed`, `vote`, `vote_with_reputation`, `execute_proposal`, `veto_proposal`, `cancel_proposal`, `treasury_transfer`, `get_treasury_balance`, `get_proposal`, `get_dao_stats`, `get_active_proposals`, `initialize`, `cast_vote`, `finalize_proposal`, `get_proposal_count`, `get_vote`, `get_vote_count`, `get_total_supply`, `set_quorum`, `set_voting_period`, `set_timelock_delay`, `dao_pause`, `dao_unpause`, `set_moltyid_address`

- `moltmarket`: NFT marketplace with offers. Exports: `initialize`, `list_nft`, `buy_nft`, `cancel_listing`, `get_listing`, `set_marketplace_fee`, `list_nft_with_royalty`, `make_offer`, `cancel_offer`, `accept_offer`, `get_marketplace_stats`, `mm_pause`, `mm_unpause`

- `moltoracle`: Price feeds, randomness, and attestation. Exports: `initialize_oracle`, `add_price_feeder`, `set_authorized_attester`, `submit_price`, `get_price`, `commit_randomness`, `reveal_randomness`, `request_randomness`, `get_randomness`, `submit_attestation`, `verify_attestation`, `get_attestation_data`, `query_oracle`, `get_aggregated_price`, `get_oracle_stats`, `initialize`, `register_feed`, `get_feed_count`, `get_feed_list`, `add_reporter`, `remove_reporter`, `set_update_interval`, `mo_pause`, `mo_unpause`

- `moltpunks`: NFT collection (ERC-721 equivalent). Exports: `initialize`, `mint`, `transfer`, `owner_of`, `balance_of`, `approve`, `transfer_from`, `burn`, `total_minted`, `mint_punk`, `transfer_punk`, `get_owner_of`, `get_total_supply`, `get_punk_metadata`, `get_punks_by_owner`, `set_base_uri`, `set_max_supply`, `set_royalty`, `mp_pause`, `mp_unpause`, `get_collection_stats`

- `moltswap`: AMM DEX with flash loans and TWAP. Exports: `initialize`, `add_liquidity`, `remove_liquidity`, `swap_a_for_b`, `swap_b_for_a`, `swap_a_for_b_with_deadline`, `swap_b_for_a_with_deadline`, `get_quote`, `get_reserves`, `get_liquidity_balance`, `get_total_liquidity`, `flash_loan_borrow`, `flash_loan_repay`, `flash_loan_abort`, `get_flash_loan_fee`, `get_twap_cumulatives`, `get_twap_snapshot_count`, `set_protocol_fee`, `get_protocol_fees`, `set_identity_admin`, `set_moltyid_address`, `set_reputation_discount`, `ms_pause`, `ms_unpause`, `create_pool`, `swap`, `get_pool_info`, `get_pool_count`, `set_platform_fee`, `get_swap_count`, `get_total_volume`, `get_swap_stats`

- `moltyid`: Decentralized identity with names, reputation, skills, attestations, and agent profiles. Exports: `initialize`, `register_identity`, `get_identity`, `update_reputation_typed`, `update_reputation`, `add_skill`, `add_skill_as`, `get_skills`, `vouch`, `set_recovery_guardians`, `approve_recovery`, `execute_recovery`, `get_reputation`, `deactivate_identity`, `get_identity_count`, `update_agent_type`, `get_vouches`, `award_contribution_achievement`, `get_achievements`, `attest_skill`, `get_attestations`, `revoke_attestation`, `register_name`, `resolve_name`, `reverse_resolve`, `create_name_auction`, `bid_name_auction`, `finalize_name_auction`, `get_name_auction`, `transfer_name`, `renew_name`, `release_name`, `transfer_name_as`, `renew_name_as`, `release_name_as`, `set_endpoint`, `get_endpoint`, `set_metadata`, `get_metadata`, `set_availability`, `get_availability`, `set_rate`, `get_rate`, `set_delegate`, `revoke_delegate`, `get_delegate`, `set_endpoint_as`, `set_metadata_as`, `set_availability_as`, `set_rate_as`, `update_agent_type_as`, `get_agent_profile`, `get_trust_tier`, `mid_pause`, `mid_unpause`, `transfer_admin`, `set_mid_token_address`, `set_mid_self_address`, `admin_register_reserved_name`

- `musd_token`: Stablecoin (mUSD) with reserve attestation. Exports: `initialize`, `mint`, `burn`, `transfer`, `approve`, `transfer_from`, `attest_reserves`, `balance_of`, `allowance`, `total_supply`, `total_minted`, `total_burned`, `get_reserve_ratio`, `get_last_attestation_slot`, `get_attestation_count`, `get_epoch_remaining`, `get_transfer_count`, `emergency_pause`, `emergency_unpause`, `transfer_admin`

- `prediction_market`: Binary outcome prediction markets with AMM pricing. Exports: `initialize`, `call`

- `reef_storage`: Decentralized storage with provider staking and challenges. Exports: `store_data`, `confirm_storage`, `get_storage_info`, `register_provider`, `claim_storage_rewards`, `initialize`, `set_molt_token`, `set_challenge_window`, `set_slash_percent`, `stake_collateral`, `set_storage_price`, `get_storage_price`, `get_provider_stake`, `issue_challenge`, `respond_challenge`, `slash_provider`, `get_platform_stats`

- `shielded_pool`: Zero-knowledge shielded transaction pool for private transfers. Internal module — no direct WASM exports (uses core integration).

- `wbnb_token`: Wrapped BNB token with reserve attestation. Exports: `initialize`, `mint`, `burn`, `transfer`, `approve`, `transfer_from`, `attest_reserves`, `balance_of`, `allowance`, `total_supply`, `total_minted`, `total_burned`, `get_reserve_ratio`, `get_last_attestation_slot`, `get_attestation_count`, `get_epoch_remaining`, `get_transfer_count`, `emergency_pause`, `emergency_unpause`, `transfer_admin`

- `weth_token`: Wrapped ETH token with reserve attestation. Exports: `initialize`, `mint`, `burn`, `transfer`, `approve`, `transfer_from`, `attest_reserves`, `balance_of`, `allowance`, `total_supply`, `total_minted`, `total_burned`, `get_reserve_ratio`, `get_last_attestation_slot`, `get_attestation_count`, `get_epoch_remaining`, `get_transfer_count`, `emergency_pause`, `emergency_unpause`, `transfer_admin`

- `wsol_token`: Wrapped SOL token with reserve attestation. Exports: `initialize`, `mint`, `burn`, `transfer`, `approve`, `transfer_from`, `attest_reserves`, `balance_of`, `allowance`, `total_supply`, `total_minted`, `total_burned`, `get_reserve_ratio`, `get_last_attestation_slot`, `get_attestation_count`, `get_epoch_remaining`, `get_transfer_count`, `emergency_pause`, `emergency_unpause`, `transfer_admin`

---

## Architecture

### Core Components

| Component | Crate | Purpose |
|-----------|-------|---------|
| Core | `moltchain-core` | State machine, accounts, transactions, WASM VM, consensus |
| RPC | `moltchain-rpc` | JSON-RPC server, REST API, WebSocket subscriptions |
| P2P | `moltchain-p2p` | Gossip protocol, block propagation, validator announce |
| Validator | `moltchain-validator` | Block production, slot scheduling, auto-update |
| CLI | `moltchain-cli` | Command-line wallet and admin tool |
| Compiler | `moltchain-compiler` | Rust → WASM contract compilation pipeline |
| Custody | `moltchain-custody` | Multi-signature custody with threshold signing |

### Transaction Format

```
Transaction {
    from: [u8; 32],           // Ed25519 public key
    recent_blockhash: [u8; 32],
    instructions: Vec<Instruction>,
    signatures: Vec<Signature>,
}

Instruction {
    program_id: [u8; 32],     // Contract address
    accounts: Vec<AccountMeta>,
    data: Vec<u8>,            // Borsh-encoded args
}
```

Encoding: SDK uses bincode; JSON is also accepted (first-byte heuristic routing).

### Economic Parameters

| Parameter | Value |
|-----------|-------|
| Base fee | 0.000005 MOLT (5000 shells) |
| Fee split | 50% burn, 50% validator |
| Slots per day | 216 000 |
| Epoch length | 432 000 slots (~2 days) |
| Initial supply | 1 000 000 000 MOLT |

---

## RPC Methods

### Read Methods

| Method | Parameters | Description |
|--------|-----------|-------------|
| `getBalance` | `[address]` | Returns balance in shells with `spendable`, `staked`, `total` |
| `getAccountInfo` | `[address]` | Full account data including owner program |
| `getTransaction` | `[txHash]` | Transaction details and execution result |
| `getBlock` | `[slot]` | Block at slot number |
| `getSlot` | `[]` | Current slot height |
| `getBlockHeight` | `[]` | Current block height |
| `getRecentBlockhash` | `[]` | Latest blockhash for transaction signing |
| `getGenesisHash` | `[]` | Genesis block hash |
| `getVersion` | `[]` | Node version string |
| `getHealth` | `[]` | Node health status |
| `getTokenSupply` | `[mint]` | Token total supply |
| `getTokenAccountsByOwner` | `[owner]` | All token accounts for owner |
| `getVoteAccounts` | `[]` | Active validators and stakes |
| `getStakeActivation` | `[address]` | Stake account activation status |
| `getContractAbi` | `[programId]` | Contract ABI (exported functions) |
| `getFeeConfig` | `[]` | Network fee parameters |
| `getMetrics` | `[]` | Network performance metrics |
| `getEpochInfo` | `[]` | Current epoch details |

### Write Methods

| Method | Parameters | Description |
|--------|-----------|-------------|
| `sendTransaction` | `[base64EncodedTx]` | Submit signed transaction |
| `simulateTransaction` | `[base64EncodedTx]` | Dry-run without committing |
| `requestAirdrop` | `[address, amountMOLT]` | Testnet faucet (max 100 MOLT, 1/60s rate limit) |
| `stake` | `[base64EncodedTx]` | Delegate stake to validator |
| `unstake` | `[base64EncodedTx]` | Undelegate stake |

### DEX REST API (port 8899)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dex/pairs` | GET | All trading pairs with tickers |
| `/api/dex/orderbook/:pair` | GET | Order book depth (bids/asks) |
| `/api/dex/trades/:pair` | GET | Recent trades |
| `/api/dex/candles/:pair` | GET | OHLCV candle data |
| `/api/dex/ticker/24h` | GET | 24h statistics |
| `/api/dex/account/:address` | GET | User positions and balances |

### WebSocket Subscriptions (port 8900)

| Subscription | Description |
|-------------|-------------|
| `slotNotification` | New slot produced |
| `blockNotification` | New block finalized |
| `accountNotification` | Account data changed |
| `transactionNotification` | Transaction confirmed |
| `dexTradeNotification` | DEX trade executed |
| `dexOrderbookNotification` | Order book updated |
| `dexPriceNotification` | Price tick |

---

## CLI Reference

```bash
moltchain-cli balance <address>
moltchain-cli transfer <from_keypair> <to_address> <amount_molt>
moltchain-cli deploy <keypair> <wasm_path>
moltchain-cli call <keypair> <program_id> <function> [args...]
moltchain-cli stake <keypair> <validator_address> <amount_molt>
moltchain-cli unstake <keypair> <validator_address> <amount_molt>
moltchain-cli keygen [--output <path>]
moltchain-cli airdrop <address> <amount_molt>
```

---

## Validator Operations

### Start

```bash
# Single testnet node
bash moltchain-start.sh testnet

# Multi-validator (3 nodes)
bash moltchain-start.sh
```

### Stop

```bash
bash moltchain-stop.sh
```

### Reset

```bash
bash reset-blockchain.sh
```

### Auto-Update

```bash
# Check-only mode (logs available updates)
./target/release/moltchain-validator --auto-update=check

# Full automatic (downloads, verifies, restarts)
./target/release/moltchain-validator --auto-update=apply

# Custom check interval (seconds)
./target/release/moltchain-validator --auto-update=apply --update-check-interval=300

# Channel selection
./target/release/moltchain-validator --auto-update=apply --update-channel=beta
```

Exit code 75 signals the supervisor loop to restart with the new binary.
Rollback guard: 3 crashes within 60s of update → automatic rollback.

---

## Build & Test

### Build

```bash
# Full workspace
cargo build --release

# Single crate
cargo build --release -p moltchain-validator

# Contracts (requires wasm32 target)
rustup target add wasm32-unknown-unknown
cd contracts/moltcoin && cargo build --target wasm32-unknown-unknown --release
```

### Test Suites

| Suite | Command | Tests |
|-------|---------|-------|
| Core unit | `cargo test -p moltchain-core` | Rust unit tests |
| RPC unit | `cargo test -p moltchain-rpc` | Rust unit tests |
| Validator unit | `cargo test -p moltchain-validator` | Rust unit tests (incl. 11 auto-update) |
| DEX unit | `node dex/dex.test.js` | 1877 JS tests |
| E2E transactions | `node tests/e2e-transactions.js` | 26 tests |
| E2E production | `node tests/e2e-production.js` | 180 tests |
| E2E DEX | `node tests/e2e-dex.js` | 87 tests |
| E2E volume | `node tests/e2e-volume.js` | 115+ tests |
| E2E launchpad | `node tests/e2e-launchpad.js` | 48 tests |
| E2E prediction | `node tests/e2e-prediction.js` | 49 tests |

All tests require a running validator (`bash moltchain-start.sh testnet`).

### Run All E2E

```bash
bash moltchain-start.sh testnet
sleep 5
for suite in tests/e2e-transactions.js tests/e2e-production.js tests/e2e-dex.js tests/e2e-volume.js tests/e2e-launchpad.js tests/e2e-prediction.js; do
    echo "=== $suite ===" && node "$suite"
done
node dex/dex.test.js
```

---

## Deployment

### Docker

```bash
docker-compose up -d
```

### Systemd

```bash
sudo cp deploy/moltchain-validator.service /etc/systemd/system/
sudo systemctl enable moltchain-validator
sudo systemctl start moltchain-validator
```

### Production Checklist

1. Build release binary: `cargo build --release`
2. Generate keypair: `moltchain-cli keygen --output validator-key.json`
3. Configure `config.toml` (RPC bind, P2P port, data directory)
4. Start with auto-update: `--auto-update=apply`
5. Monitor via `/api/health` and `/api/metrics`
6. Set up log rotation for `logs/` directory

---

## Known Limitations

- ClawPump contract does not reject operations on non-existent token IDs (validation gap)
- Prediction market contract does not reject zero-amount buys or invalid outcome indices (validation gap)
- Prediction market REST stats may show 0 markets due to aggregation delay
- Airdrop rate limit: 1 per 60 seconds per source IP
- Bincode 1.x can panic on adversarial input — mitigated with `catch_unwind` in RPC handlers
