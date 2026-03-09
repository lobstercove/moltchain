# MoltChain — Copilot Workspace Instructions

> You are working on **MoltChain**, a custom Layer 1 blockchain built by agents, for agents.
> Read `SKILL.md` at the repo root for the complete operational reference (1800+ lines).

## Project Identity

| Property | Value |
|----------|-------|
| Chain | MoltChain (custom L1, Proof of Stake) |
| Language | Rust (core, contracts), JavaScript (frontends, SDKs), Python (SDK) |
| Slot time | 400 ms |
| Native token | MOLT (1 MOLT = 1,000,000,000 shells) |
| Signing | Ed25519 |
| Smart contracts | WASM (Rust → wasm32-unknown-unknown) |
| ZK proofs | Groth16 over BN254 |
| Contracts at genesis | 29 |
| RPC | JSON-RPC 2.0 port 8899 + Solana compat `/solana` + EVM compat `/evm` |
| WebSocket | Port 8900 |

## Repository Structure

```
core/         — State machine, accounts, transactions, WASM VM, ZK verifier, consensus
validator/    — Block production, slot scheduling, auto-update, built-in supervisor
rpc/          — JSON-RPC server, REST API, WebSocket subscriptions
p2p/          — QUIC gossip protocol, block propagation, validator announce
cli/          — `molt` command-line wallet tool
custody/      — Multi-sig custody with threshold signing, bridge deposits/withdrawals
faucet-service/ — Testnet MOLT dispenser
genesis/      — Genesis block generation (compiles + deploys 29 contracts)
compiler/     — Rust → WASM contract compilation pipeline
contracts/    — 29 WASM smart contracts (each has own Cargo.toml)
sdk/          — Contract SDK (`moltchain-contract-sdk`), Client SDKs (JS, Python, Rust `moltchain-client-sdk`)
wallet/       — Browser wallet app
explorer/     — Block explorer
dex/          — ClawSwap decentralized exchange
developers/   — Developer portal
marketplace/  — NFT marketplace
programs/     — Programs IDE
monitoring/   — Prometheus/Grafana monitoring dashboard
website/      — Landing page
deploy/       — Systemd services, Caddy configs
infra/        — Docker Compose, Prometheus, Grafana configs
scripts/      — Operational scripts (genesis, health-check, deploy)
tests/        — End-to-end integration tests
```

## Cargo Workspace Members

`core`, `validator`, `rpc`, `cli`, `p2p`, `faucet-service`, `custody`, `genesis` — contracts are excluded (separate builds).

## Build Commands

```bash
cargo build --release                    # Build all workspace crates
make build                               # Full build (node + WASM contracts + CLI + SDK)
make test                                # Run all tests
make lint                                # Clippy (workspace + contracts)
make fmt                                 # Format all code
make check                               # cargo check workspace + contracts
make health                              # Health check running node
cargo test --workspace --release         # Rust tests only
```

## Contract Build

Each contract in `contracts/` has its own `Cargo.toml`. Build to WASM:
```bash
cd contracts/<name> && cargo build --target wasm32-unknown-unknown --release
```
Or use `make build-contracts-wasm` for all.

## Quality Standards — MANDATORY

Every change must meet these criteria. No exceptions:

1. **No stubs, no placeholders, no mock data, no TODOs in shipped code**
2. **No partial fixes or bandaids** — complete the full implementation
3. **Build without errors AND without warnings** — `cargo build --release` must be clean
4. **Every feature has an end-to-end test** — test like a real user would use it
5. **Every endpoint must be implemented, wired, and tested** — nothing left unwired
6. **All tasks done in order, one by one** — compare with existing code first
7. **Clean clippy** — `cargo clippy --workspace -- -D warnings` must pass

## Testing Principles

- E2E tests simulate real user flows (create account → fund → transact → verify)
- Contract tests verify WASM execution paths
- RPC tests verify every method returns correct data
- Integration tests span multiple services (validator + RPC + contracts)
- Run `make test` or `cargo test --workspace --release` before any commit

## Key Technical Details

- **Transaction format**: Bincode serialization → base64 for RPC transport
- **System Program**: `[0x00; 32]` — native instructions (transfer, stake, NFT, ZK)
- **Contract Program**: `[0xFF; 32]` — WASM contract calls (Deploy, Call, Upgrade, Close)
- **Contract dispatch**: Named exports (23 contracts) or opcode dispatch (7 DEX contracts)
- **Fee structure**: 40% burn, 30% block producer, 10% voters, 10% treasury, 10% community
- **Base fee**: 0.001 MOLT (1,000,000 shells)

## Production Endpoints

| Service | URL |
|---------|-----|
| RPC (Mainnet) | `https://rpc.moltchain.network` |
| WebSocket (Mainnet) | `wss://ws.moltchain.network` |
| Seed nodes | `seed-01.moltchain.network:8001`, `seed-02.moltchain.network:8001`, `seed-03.moltchain.network:8001` |

## Deployment Architecture (3-VPS)

- US VPS (seed-01): Validator, RPC, WS, Custody, Faucet, Caddy
- EU VPS (seed-02): Validator, RPC, WS, Caddy
- SEA VPS (seed-03): Validator, RPC, WS, Caddy
- Cloudflare Pages: All frontend portals (website, explorer, wallet, dex, marketplace, programs, developers, monitoring)
- Testnet ports: RPC=8899, WS=8900, P2P=7001
- Mainnet ports: RPC=9899, WS=9900, P2P=8001

## Current Status

- **Phase**: Phase 2 Network Expansion (Phase 1 Live Foundation complete)
- **Deployment**: Phase 4 done (frontend config fixes), Phase 0-3 pending (DNS, VPS, genesis)
- **Contracts**: 29 deployed at genesis, 7 more planned for Phase 2 Agent Economy
- See `DEPLOYMENT_STATUS.md` for the detailed task tracker

## Documentation

- `SKILL.md` — Complete agent skill book (contracts, RPC, WS, CLI, identity, staking, ZK)
- `docs/` — Architecture, deployment, audits, strategy, guides
- `docs/strategy/PHASE2_AGENT_ECONOMY.md` — 7 planned economy contracts
- `docs/strategy/PHASE2_ACTIVATION_PLAN.md` — ReefStake activation checklist
- `docs/deployment/PRODUCTION_DEPLOYMENT.md` — Full production deployment guide
- `docs/guides/RPC_API_REFERENCE.md` — Detailed RPC request/response examples

## Session Continuity

When starting a new session, always:
1. Read `SKILL.md` for complete project reference
2. Read `DEPLOYMENT_STATUS.md` for current deployment state
3. Check `/memories/repo/` for accumulated knowledge
4. Check `.github/` for latest instructions, agents, and prompts
5. Review `docs/strategy/` for current phase priorities
