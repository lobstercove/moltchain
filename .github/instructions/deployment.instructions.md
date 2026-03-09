---
description: "Use when editing deployment configs: systemd services, Caddy configs, Docker Compose, setup scripts, and operational scripts."
applyTo: ["deploy/**", "infra/**", "scripts/**", "docker-compose.yml", "Dockerfile"]
---
# Deployment & Infrastructure Guidelines

## VPS Architecture
- US (seed-01, 15.204.229.189): Validator + RPC + WS + Custody + Faucet + Caddy
- EU (seed-02, 37.59.97.61): Validator + RPC + WS + Caddy
- SEA (seed-03, 15.235.142.253): Validator + RPC + WS + Caddy
- SSH: port 2222, user `ubuntu`
- Service user: `moltchain` (runs validator, custody, faucet via systemd)

## Port Plan
| Service | Testnet | Mainnet |
|---------|---------|---------|
| RPC | 8899 | 9899 |
| WebSocket | 8900 | 9900 |
| P2P | 7001 | 8001 |
| Custody | 9105 | 9105 |
| Faucet | 8901/9100 | — |

## Systemd Services
- `deploy/moltchain-validator.service`
- `deploy/moltchain-custody.service`
- `deploy/moltchain-custody-mainnet.service`
- `deploy/moltchain-faucet.service`

## Critical Patterns
- Genesis requires `contracts/` visible from CWD
- After genesis: `chown -R moltchain:moltchain /var/lib/moltchain/*`
- Never chain `reset-blockchain.sh` with `moltchain-*` in one SSH command
- Use full tarball for VPS staging (not `git archive` — ignored dirs may be needed)
- Always update `DEPLOYMENT_STATUS.md` after completing tasks
