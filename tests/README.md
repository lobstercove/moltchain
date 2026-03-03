# MoltChain Test Suite

All integration, end-to-end, and audit tests live here. Rust unit tests remain
co-located with their crates (`core/`, `rpc/`, `contracts/*/`, `sdk/rust/`).

---

## Quick Start

```bash
# Rust unit + contract tests
make test

# Full production gate (requires running 3-validator cluster)
bash tests/production-e2e-gate.sh

# Full 43-suite matrix
bash tests/run-full-matrix-feb24.sh

# Quick smoke check
python3 tests/quick-check.py
```

---

## Test Categories

### Runners & Orchestrators

Top-level scripts that launch clusters and run multiple test suites:

| File | Description |
|------|-------------|
| `production-e2e-gate.sh` | **Production gate** — the canonical pass/fail gate |
| `run-full-matrix-feb24.sh` | **Full matrix** — runs all 43 test suites with reporting |
| `matrix-test-3val.sh` | 7-phase standalone matrix (RPC, CLI, WS, contracts, DEX, SDK, security) |
| `matrix-sdk-cluster.sh` | SDK cluster manager (start/stop/restart validators for matrix) |
| `multi-validator-e2e.sh` | Multi-validator consensus E2E |
| `live-e2e-test.sh` | Live 239-endpoint API sweep |
| `services-deep-e2e.sh` | Deep service integration (all frontends + backends) |
| `launch-3v.sh` | Helper: launch 3-validator cluster |
| `run-e2e.sh` | Helper: simple E2E launcher |

### End-to-End Suites (Python)

Full-stack tests covering RPC, contracts, and business logic:

| File | Description |
|------|-------------|
| `comprehensive-e2e.py` | Sequential comprehensive E2E (2098 lines) |
| `comprehensive-e2e-parallel.py` | Parallel version with asyncio (1606 lines) |
| `contracts-write-e2e.py` | All 27 contracts — deploy, write, validate (1534 lines) |
| `e2e-developer-lifecycle.py` | Full developer workflow E2E |
| `e2e-dex-trading.py` | DEX trading scenarios (pairs, swaps, liquidity) |
| `e2e-genesis-wiring.py` | Genesis block + initial state wiring |
| `e2e-websocket-upgrade.py` | WebSocket upgrade and reconnection |
| `load-test-5k-traders.py` | Load test: 5000 concurrent traders |

### End-to-End Suites (JavaScript)

| File | Description |
|------|-------------|
| `e2e-dex.js` | DEX frontend integration |
| `e2e-launchpad.js` | Launchpad token creation flows |
| `e2e-prediction.js` | Prediction market creation/resolution |
| `e2e-production.js` | Production readiness validation |
| `e2e-transactions.js` | Transaction lifecycle tests |
| `e2e-volume.js` | Volume and throughput tests |
| `manual-margin-mode-e2e.js` | Margin mode toggle E2E |

### Integration Tests (Shell)

Component-level tests against live services:

| File | Description |
|------|-------------|
| `test-cli-comprehensive.sh` | CLI command coverage |
| `test-contract-deployment.sh` | Contract deploy + verify |
| `test-rpc-comprehensive.sh` | RPC endpoint coverage |
| `test-websocket.sh` | WebSocket subscribe/stream |
| `test-dex-api-comprehensive.sh` | DEX REST API coverage |
| `test-critical-security.sh` | Security assertions |
| `test-mkt-featured-filter.sh` | Marketplace featured filter |
| `test-ws-dex.js` | WebSocket DEX channels |

### Frontend Audit Tests

Puppeteer/source-level tests validating frontend audit findings:

| File | Description |
|------|-------------|
| `test_coverage_audit.js` | Overall coverage matrix audit |
| `test_cross_cutting_audit.js` | Cross-cutting concerns (auth, errors) |
| `test_developers_audit.js` | Developer portal audit |
| `test_marketplace_audit.js` | Marketplace audit (69k, 7 findings) |
| `test_programs_override_wiring.js` | Programs tab override wiring |
| `test_wallet_audit.js` | Wallet audit (42k) |
| `test_wallet_extension_audit.js` | Wallet extension audit |
| `test_wallet_modal_parity.js` | Wallet modal parity |
| `test_website_audit.js` | Website audit |
| `test_ws_reconnect_stress.js` | WebSocket reconnect stress test |

### Utilities & Helpers

| File | Description |
|------|-------------|
| `helpers/funded-wallets.js` | Funded wallet addresses for tests |
| `start-validator.sh` | Dev validator launcher (`--keep-state`, `--dev-mode`) |
| `expected-contracts.json` | Expected contract list for validation |
| `update-expected-contracts.py` | Regenerate expected-contracts.json |
| `resolve-funded-signers.py` | Resolve funded signer keypairs |
| `debug-preflight.js` | Pre-flight connectivity check |
| `quick-check.py` | Quick smoke test |

### Rust E2E Crate

| Path | Description |
|------|-------------|
| `e2e/` | Rust integration test crate (`cargo test` from `tests/e2e/`) |

---

## Artifacts

Test reports and run logs are written to `tests/artifacts/` (gitignored).
Historical artifacts are archived in `tests/artifacts/archive_feb24_2026_section5/`.

---

## Co-located Tests (not in this directory)

These tests live with their respective modules:

| Location | What |
|----------|------|
| `core/tests/` | Core blockchain Rust tests |
| `rpc/tests/` | RPC handler Rust tests |
| `contracts/*/tests/` | Per-contract adversarial Rust tests |
| `sdk/js/test*.js` | JavaScript SDK tests |
| `sdk/python/*test*.py` | Python SDK tests |
| `sdk/rust/examples/` | Rust SDK integration examples |
| `dex/dex.test.js` | DEX frontend test |
| `explorer/explorer.test.js` | Explorer frontend test |
| `faucet/faucet.test.js` | Faucet frontend test |
| `deploy/deploy.test.js` | Deployment integration test |
| `scripts/test-all-sdks.sh` | SDK cross-language test runner |
| `scripts/coverage_self_test.py` | Contract coverage self-test |
