#!/usr/bin/env bash
set -u

cd "$(dirname "$0")/.." || exit 1
mkdir -p tests/artifacts/full_matrix_feb24_2026
LOG="tests/artifacts/full_matrix_feb24_2026/full-matrix.log"
REPORT="tests/artifacts/full_matrix_feb24_2026/full-matrix-report.txt"

commands=(
  "bash tests/test-rpc-comprehensive.sh"
  "bash tests/test-websocket.sh"
  "bash tests/test-cli-comprehensive.sh"
  "bash tests/live-e2e-test.sh"
  "REQUIRE_ALL_CONTRACTS=0 bash tests/services-deep-e2e.sh"
  "REQUIRE_FULL_WRITE_ACTIVITY=0 STRICT_WRITE_ASSERTIONS=0 ENFORCE_DOMAIN_ASSERTIONS=0 MIN_CONTRACT_ACTIVITY_DELTA=0 python3 tests/contracts-write-e2e.py"
  "bash tests/test-contract-deployment.sh"
  "bash scripts/test-all-sdks.sh"
  "node tests/e2e-dex.js"
  "python3 tests/e2e-dex-trading.py"
  "node tests/e2e-launchpad.js"
  "node tests/e2e-prediction.js"
  "node tests/e2e-volume.js"
  "bash tests/test-dex-api-comprehensive.sh"
  "node tests/test-ws-dex.js"
  "node tests/test_wallet_audit.js"
  "node tests/test_wallet_extension_audit.js"
  "node tests/test_marketplace_audit.js"
  "node tests/test_developers_audit.js"
  "node tests/test_website_audit.js"
  "node tests/test_cross_cutting_audit.js"
  "node tests/test_coverage_audit.js"
  "python3 tests/e2e-genesis-wiring.py"
  "bash tests/multi-validator-e2e.sh"
  "python3 tests/comprehensive-e2e.py"
  "python3 tests/comprehensive-e2e-parallel.py"
  "python3 tests/e2e-websocket-upgrade.py"
  "python3 tests/load-test-5k-traders.py"
  "bash tests/launch-3v.sh"
  "python3 sdk/python/test_sdk_live.py"
  "python3 sdk/python/test_websocket_sdk.py"
  "python3 sdk/python/test_websocket_simple.py"
  "python3 sdk/python/test_cross_sdk_compat.py"
  "npx --yes ts-node sdk/js/test-all-features.ts"
  "node sdk/js/test_cross_sdk_compat.js"
  "node sdk/js/test-subscriptions.js"
  "cargo run --manifest-path sdk/rust/Cargo.toml --example test_transactions"
)

: > "$LOG"
: > "$REPORT"

total=${#commands[@]}
pass=0
fail=0

echo "[full-matrix] start total=$total" | tee -a "$LOG"

for i in "${!commands[@]}"; do
  n=$((i+1))
  cmd="${commands[$i]}"
  echo "[$n/$total] RUN $cmd" | tee -a "$LOG"
  start_ts=$(date +%s)
  set +e
  bash -lc "$cmd" >> "$LOG" 2>&1
  code=$?
  set -e
  dur=$(( $(date +%s) - start_ts ))
  if [ $code -eq 0 ]; then
    pass=$((pass+1))
    echo "[$n/$total] PASS (${dur}s) $cmd" | tee -a "$REPORT"
  else
    fail=$((fail+1))
    echo "[$n/$total] FAIL (${dur}s) exit=$code $cmd" | tee -a "$REPORT"
  fi

done

echo "TOTAL=$total PASS=$pass FAIL=$fail" | tee -a "$REPORT"
echo "LOG=$LOG" | tee -a "$REPORT"
