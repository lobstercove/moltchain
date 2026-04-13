#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
BIN="$ROOT/target/release/lichen-validator"
FAUCET_BIN="$ROOT/target/release/lichen-faucet"
LAUNCHER="$ROOT/run-validator.sh"
FIRST_BOOT_DEPLOY="$ROOT/scripts/first-boot-deploy.sh"
SIGNED_METADATA_MANIFEST="$ROOT/signed-metadata-manifest-testnet.json"
SIGNED_METADATA_KEYPAIR_DEFAULT="$ROOT/keypairs/release-signing-key.json"

export LICHEN_LOCAL_DEV=1

FORCE_MANAGED_MATRIX_CLUSTER="${FORCE_MANAGED_MATRIX_CLUSTER:-0}"
RESET_MATRIX_STATE="${RESET_MATRIX_STATE:-0}"
MATRIX_BUILD_FIRST="${MATRIX_BUILD_FIRST:-0}"
MATRIX_STAGGER_SECS="${MATRIX_STAGGER_SECS:-15}"
MATRIX_MIN_VALIDATORS="${MATRIX_MIN_VALIDATORS:-3}"
MATRIX_EXTERNAL_CLUSTER_ONLY="${MATRIX_EXTERNAL_CLUSTER_ONLY:-0}"

DATA1="$ROOT/data/state-7001"
DATA2="$ROOT/data/state-7002"
DATA3="$ROOT/data/state-7003"
LEGACY_MATRIX_DATA_GLOB="$ROOT/data/matrix-sdk-state-*"

ARTIFACT_DIR="$ROOT/tests/artifacts/full_matrix_feb24_2026/sdk_cluster"
PID_FILE="$ARTIFACT_DIR/pids.txt"
MODE_FILE="$ARTIFACT_DIR/mode.txt"
LOG1="$ARTIFACT_DIR/v1.log"
LOG2="$ARTIFACT_DIR/v2.log"
LOG3="$ARTIFACT_DIR/v3.log"
BOOTSTRAP_LOG="$ARTIFACT_DIR/bootstrap.log"
FAUCET_LOG="$ARTIFACT_DIR/faucet.log"
FAUCET_PID_FILE="$ARTIFACT_DIR/faucet.pid"
FAUCET_AIRDROPS_FILE="$ARTIFACT_DIR/airdrops.json"
FAUCET_PORT=9100

mkdir -p "$ARTIFACT_DIR"

kill_stale_validator_supervisors() {
  pkill -f 'scripts/validator-supervisor\.sh .*run-validator\.sh testnet 1' 2>/dev/null || true
  pkill -f 'scripts/validator-supervisor\.sh .*run-validator\.sh testnet 2' 2>/dev/null || true
  pkill -f 'scripts/validator-supervisor\.sh .*run-validator\.sh testnet 3' 2>/dev/null || true
  pkill -f 'scripts/validator-supervisor\.sh .*run-validator\.sh mainnet 1' 2>/dev/null || true
  pkill -f 'scripts/validator-supervisor\.sh .*run-validator\.sh mainnet 2' 2>/dev/null || true
  pkill -f 'scripts/validator-supervisor\.sh .*run-validator\.sh mainnet 3' 2>/dev/null || true
  pkill -f 'target/(release|debug)/lichen-validator .*--p2p-port (7001|7002|7003|8001|8002|8003)' 2>/dev/null || true
}

rpc_ok() {
  local port="$1"
  curl -sf --connect-timeout 1 --max-time 2 "http://127.0.0.1:${port}" \
    -X POST -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getSlot"}' >/dev/null 2>&1
}

faucet_ok() {
  curl -sf --connect-timeout 2 --max-time 5 "http://127.0.0.1:${FAUCET_PORT}/health" >/dev/null 2>&1
}

validator_count() {
  curl -sf --connect-timeout 1 --max-time 2 "http://127.0.0.1:8899" \
    -X POST -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getValidators","params":[]}' \
    | python3 -c 'import sys,json; d=json.load(sys.stdin).get("result",[]); v=d.get("validators", d) if isinstance(d, dict) else d; print(len(v) if isinstance(v, list) else 0)' 2>/dev/null \
    || echo 0
}

external_cluster_healthy() {
  local require_faucet="${1:-0}"

  if ! rpc_ok 8899 || ! rpc_ok 8901 || ! rpc_ok 8903; then
    return 1
  fi

  local vcount
  vcount="$(validator_count)"
  if [[ "$vcount" -lt "$MATRIX_MIN_VALIDATORS" ]]; then
    return 1
  fi

  if [[ "$require_faucet" == "1" ]] && ! faucet_ok; then
    return 1
  fi

  return 0
}

wait_cluster_ready() {
  local attempts="${1:-60}"
  local delay="${2:-1}"
  for _ in $(seq 1 "$attempts"); do
    if rpc_ok 8899; then
      local vcount
      vcount="$(validator_count)"
      if [[ "$vcount" -ge "$MATRIX_MIN_VALIDATORS" ]]; then
        return 0
      fi
    fi
    sleep "$delay"
  done
  return 1
}

wait_rpc() {
  local port="$1"
  local attempts="${2:-40}"
  local delay="${3:-1}"
  for _ in $(seq 1 "$attempts"); do
    if rpc_ok "$port"; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

kill_port_listener() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    for pid in $pids; do
      kill "$pid" 2>/dev/null || true
    done
    sleep 1
    pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      for pid in $pids; do
        kill -9 "$pid" 2>/dev/null || true
      done
    fi
  fi
}

wait_faucet() {
  local attempts="${1:-40}"
  local delay="${2:-1}"
  for _ in $(seq 1 "$attempts"); do
    if faucet_ok; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

refresh_bootstrap_artifacts() {
  local signed_metadata_keypair="${SIGNED_METADATA_KEYPAIR:-$SIGNED_METADATA_KEYPAIR_DEFAULT}"

  if [[ ! -x "$FIRST_BOOT_DEPLOY" ]]; then
    echo "[matrix-sdk-cluster] ERROR: bootstrap helper not found or not executable: $FIRST_BOOT_DEPLOY"
    return 1
  fi

  if [[ ! -f "$signed_metadata_keypair" ]]; then
    echo "[matrix-sdk-cluster] ERROR: signing keypair not found: $signed_metadata_keypair"
    return 1
  fi

  echo "[matrix-sdk-cluster] refreshing bootstrap artifacts via first-boot-deploy.sh"
  if ! \
    RPC_URL="http://127.0.0.1:8899" \
    DEPLOY_NETWORK="testnet" \
    SIGNED_METADATA_KEYPAIR="$signed_metadata_keypair" \
    SIGNED_METADATA_NETWORK="local-testnet" \
    SIGNED_METADATA_MANIFEST="$SIGNED_METADATA_MANIFEST" \
    LICHEN_SIGNED_METADATA_MANIFEST_FILE="$SIGNED_METADATA_MANIFEST" \
    "$FIRST_BOOT_DEPLOY" --rpc http://127.0.0.1:8899 --skip-build >"$BOOTSTRAP_LOG" 2>&1; then
    echo "[matrix-sdk-cluster] ERROR: bootstrap artifact refresh failed"
    tail -40 "$BOOTSTRAP_LOG" 2>/dev/null || true
    return 1
  fi

  if [[ ! -f "$SIGNED_METADATA_MANIFEST" ]]; then
    echo "[matrix-sdk-cluster] ERROR: signed metadata manifest missing after bootstrap refresh: $SIGNED_METADATA_MANIFEST"
    return 1
  fi

  return 0
}

stop_managed_faucet() {
  if [[ -f "$FAUCET_PID_FILE" ]]; then
    local faucet_pid
    faucet_pid="$(cat "$FAUCET_PID_FILE" 2>/dev/null || true)"
    if [[ -n "$faucet_pid" ]]; then
      kill "$faucet_pid" 2>/dev/null || true
      sleep 1
      kill -9 "$faucet_pid" 2>/dev/null || true
    fi
    rm -f "$FAUCET_PID_FILE"
  fi

  kill_port_listener "$FAUCET_PORT"
}

start_managed_faucet() {
  if faucet_ok; then
    return 0
  fi

  if [[ ! -x "$FAUCET_BIN" ]]; then
    echo "[matrix-sdk-cluster] ERROR: faucet binary not found: $FAUCET_BIN"
    return 1
  fi

  stop_managed_faucet

  echo "[matrix-sdk-cluster] starting faucet on :$FAUCET_PORT"
  DEV_CORS=1 \
  RPC_URL="http://127.0.0.1:8899" \
  NETWORK="testnet" \
  PORT="$FAUCET_PORT" \
  TRUSTED_PROXY="127.0.0.1,::1" \
  AIRDROPS_FILE="$FAUCET_AIRDROPS_FILE" \
    "$FAUCET_BIN" >"$FAUCET_LOG" 2>&1 &
  local faucet_pid=$!
  echo "$faucet_pid" > "$FAUCET_PID_FILE"

  if ! wait_faucet 40 1; then
    echo "[matrix-sdk-cluster] ERROR: faucet did not become healthy on :$FAUCET_PORT"
    tail -20 "$FAUCET_LOG" 2>/dev/null || true
    return 1
  fi

  echo "[matrix-sdk-cluster] faucet ready pid=$faucet_pid"
}

read_pids() {
  if [[ -f "$PID_FILE" ]]; then
    cat "$PID_FILE"
    return 0
  fi
  return 1
}

stop_cluster() {
  local mode="managed"
  if [[ -f "$MODE_FILE" ]]; then
    mode="$(cat "$MODE_FILE" 2>/dev/null || echo managed)"
  fi
  if [[ "$mode" == "external" ]]; then
    rm -f "$PID_FILE" "$MODE_FILE"
    return 0
  fi
  if [[ "$MATRIX_EXTERNAL_CLUSTER_ONLY" == "1" ]] && external_cluster_healthy 0; then
    rm -f "$PID_FILE" "$MODE_FILE"
    return 0
  fi

  if read_pids >/dev/null 2>&1; then
    local pids
    pids="$(read_pids || true)"
    for pid in $pids; do
      kill "$pid" 2>/dev/null || true
    done
    sleep 1
    for pid in $pids; do
      kill -9 "$pid" 2>/dev/null || true
    done
    rm -f "$PID_FILE"
  fi

  stop_managed_faucet

  kill_stale_validator_supervisors
  for port in 8899 8901 8903 8000 8001 8002 9100 9201 9202 9203; do
    kill_port_listener "$port"
  done

  rm -f "$MODE_FILE"
}

purge_legacy_matrix_dirs() {
  shopt -s nullglob
  local dirs=($LEGACY_MATRIX_DATA_GLOB)
  shopt -u nullglob
  if [[ ${#dirs[@]} -gt 0 ]]; then
    echo "[matrix-sdk-cluster] purging legacy matrix dirs: ${dirs[*]}"
    rm -rf "${dirs[@]}"
  fi
}

count_alive_pids() {
  local pids alive
  pids="$(read_pids || true)"
  alive=0
  for pid in $pids; do
    if kill -0 "$pid" 2>/dev/null; then
      alive=$((alive + 1))
    fi
  done
  echo "$alive"
}

managed_cluster_healthy() {
  if [[ ! -f "$PID_FILE" ]]; then
    return 1
  fi

  local mode="managed"
  if [[ -f "$MODE_FILE" ]]; then
    mode="$(cat "$MODE_FILE" 2>/dev/null || echo managed)"
  fi
  if [[ "$mode" == "external" ]]; then
    return 1
  fi

  if ! rpc_ok 8899 || ! rpc_ok 8901 || ! rpc_ok 8903; then
    return 1
  fi

  local vcount
  vcount="$(validator_count)"
  [[ "$vcount" -ge "$MATRIX_MIN_VALIDATORS" ]]
}

start_cluster() {
  purge_legacy_matrix_dirs

  if [[ "$FORCE_MANAGED_MATRIX_CLUSTER" != "1" && "$RESET_MATRIX_STATE" != "1" ]] && managed_cluster_healthy; then
    if ! refresh_bootstrap_artifacts; then
      return 1
    fi
    if ! start_managed_faucet; then
      return 1
    fi
    echo "[matrix-sdk-cluster] reusing existing managed cluster (already healthy)"
    return 0
  fi

  if [[ "$FORCE_MANAGED_MATRIX_CLUSTER" != "1" ]] && external_cluster_healthy "$MATRIX_EXTERNAL_CLUSTER_ONLY"; then
    echo "external" > "$MODE_FILE"
    rm -f "$PID_FILE"
    echo "[matrix-sdk-cluster] reusing existing external cluster on :8899 (validators>=$MATRIX_MIN_VALIDATORS)"
    return 0
  fi

  if [[ "$MATRIX_EXTERNAL_CLUSTER_ONLY" == "1" ]]; then
    echo "[matrix-sdk-cluster] ERROR: external-only mode requested but relay-backed cluster is not healthy"
    return 1
  fi

  stop_cluster

  if [[ "$FORCE_MANAGED_MATRIX_CLUSTER" == "1" ]]; then
    echo "[matrix-sdk-cluster] forcing managed mode (evict/rebind :8899/:8901/:8903)"
    kill_stale_validator_supervisors
    kill_port_listener 8899
    kill_port_listener 8901
    kill_port_listener 8903
    kill_port_listener 8000
    kill_port_listener 8001
    kill_port_listener 8002
    kill_port_listener 8004
    kill_port_listener 9201
    kill_port_listener 9202
    kill_port_listener 9203
  fi

  if [[ "$RESET_MATRIX_STATE" == "1" ]]; then
    echo "[matrix-sdk-cluster] resetting canonical testnet state via reset-blockchain.sh"
    bash "$ROOT/reset-blockchain.sh" testnet >/dev/null
    rm -f "$FAUCET_AIRDROPS_FILE"
  fi

  if [[ "$MATRIX_BUILD_FIRST" == "1" || ! -x "$BIN" || ! -x "$FAUCET_BIN" ]]; then
    echo "[matrix-sdk-cluster] building validator/faucet binaries..."
    cargo build --release --bin lichen-validator --bin lichen-faucet >/dev/null
  fi

  if [[ ! -x "$LAUNCHER" ]]; then
    echo "[matrix-sdk-cluster] ERROR: launcher not found or not executable: $LAUNCHER"
    exit 1
  fi

  echo "[matrix-sdk-cluster] starting V1 (production path: run-validator.sh testnet 1)"
  LICHEN_SIGNER_BIND=127.0.0.1:9301 RUST_LOG=${MATRIX_RUST_LOG:-warn} "$LAUNCHER" testnet 1 --dev-mode >"$LOG1" 2>&1 &
  V1PID=$!
  sleep "$MATRIX_STAGGER_SECS"

  echo "[matrix-sdk-cluster] starting V2 (production path: run-validator.sh testnet 2)"
  LICHEN_SIGNER_BIND=127.0.0.1:9302 RUST_LOG=warn "$LAUNCHER" testnet 2 --dev-mode >"$LOG2" 2>&1 &
  V2PID=$!
  sleep "$MATRIX_STAGGER_SECS"

  echo "[matrix-sdk-cluster] starting V3 (production path: run-validator.sh testnet 3)"
  LICHEN_SIGNER_BIND=127.0.0.1:9303 RUST_LOG=warn "$LAUNCHER" testnet 3 --dev-mode >"$LOG3" 2>&1 &
  V3PID=$!

  echo "$V1PID $V2PID $V3PID" > "$PID_FILE"
  echo "managed" > "$MODE_FILE"

  if ! wait_rpc 8899 60 1; then
    echo "[matrix-sdk-cluster] ERROR: 8899 did not become healthy"
    stop_cluster
    exit 1
  fi
  if ! wait_rpc 8901 60 1; then
    echo "[matrix-sdk-cluster] ERROR: 8901 did not become healthy"
    stop_cluster
    exit 1
  fi
  if ! wait_rpc 8903 60 1; then
    echo "[matrix-sdk-cluster] ERROR: 8903 did not become healthy"
    stop_cluster
    exit 1
  fi

  if ! wait_cluster_ready 90 1; then
    if rpc_ok 8899 && rpc_ok 8901 && rpc_ok 8903; then
      echo "[matrix-sdk-cluster] WARN: quorum check timed out, but all validator RPC endpoints are healthy; continuing"
    else
      echo "[matrix-sdk-cluster] ERROR: cluster did not reach validator quorum >= $MATRIX_MIN_VALIDATORS"
      stop_cluster
      exit 1
    fi
  fi

  if ! refresh_bootstrap_artifacts; then
    stop_cluster
    exit 1
  fi

  if ! start_managed_faucet; then
    stop_cluster
    exit 1
  fi

  echo "[matrix-sdk-cluster] ready pids=$V1PID,$V2PID,$V3PID"
}

status_cluster() {
  if ! read_pids >/dev/null 2>&1; then
    if external_cluster_healthy "$MATRIX_EXTERNAL_CLUSTER_ONLY"; then
      local vcount
      vcount="$(validator_count)"
      if [[ "$MATRIX_EXTERNAL_CLUSTER_ONLY" == "1" ]]; then
        echo "[matrix-sdk-cluster] status=up mode=external validators=$vcount faucet=up"
      else
        echo "[matrix-sdk-cluster] status=up mode=external validators=$vcount"
      fi
      return 0
    fi
    if rpc_ok 8899 || rpc_ok 8901 || rpc_ok 8903; then
      local vcount
      vcount="$(validator_count)"
      if [[ "$MATRIX_EXTERNAL_CLUSTER_ONLY" == "1" ]]; then
        local faucet_state="down"
        if faucet_ok; then
          faucet_state="up"
        fi
        echo "[matrix-sdk-cluster] status=degraded mode=external validators=$vcount min_validators=$MATRIX_MIN_VALIDATORS faucet=$faucet_state"
      else
        echo "[matrix-sdk-cluster] status=degraded mode=external validators=$vcount/<$MATRIX_MIN_VALIDATORS"
      fi
      return 1
    fi
    echo "[matrix-sdk-cluster] status=down (no pid file)"
    return 1
  fi
  local mode="managed"
  if [[ -f "$MODE_FILE" ]]; then
    mode="$(cat "$MODE_FILE" 2>/dev/null || echo managed)"
  fi
  if [[ "$mode" == "external" ]]; then
    if external_cluster_healthy "$MATRIX_EXTERNAL_CLUSTER_ONLY"; then
      local vcount
      vcount="$(validator_count)"
      if [[ "$MATRIX_EXTERNAL_CLUSTER_ONLY" == "1" ]]; then
        echo "[matrix-sdk-cluster] status=up mode=external validators=$vcount faucet=up"
      else
        echo "[matrix-sdk-cluster] status=up mode=external validators=$vcount"
      fi
      return 0
    fi
    if rpc_ok 8899 || rpc_ok 8901 || rpc_ok 8903; then
      local vcount
      vcount="$(validator_count)"
      if [[ "$MATRIX_EXTERNAL_CLUSTER_ONLY" == "1" ]]; then
        local faucet_state="down"
        if faucet_ok; then
          faucet_state="up"
        fi
        echo "[matrix-sdk-cluster] status=degraded mode=external validators=$vcount min_validators=$MATRIX_MIN_VALIDATORS faucet=$faucet_state"
      else
        echo "[matrix-sdk-cluster] status=degraded mode=external validators=$vcount/<$MATRIX_MIN_VALIDATORS"
      fi
      return 1
    fi
    echo "[matrix-sdk-cluster] status=down mode=external"
    return 1
  fi
  local pids
  pids="$(read_pids || true)"
  local alive=0
  local faucet_state="down"
  alive="$(count_alive_pids)"

  if faucet_ok; then
    faucet_state="up"
  fi

  local vcount
  vcount="$(validator_count)"
  if rpc_ok 8899 && rpc_ok 8901 && rpc_ok 8903 && [[ "$vcount" -ge "$MATRIX_MIN_VALIDATORS" ]] && [[ "$faucet_state" == "up" ]]; then
    local launcher_state="alive=$alive/3"
    if [[ "$alive" -ne 3 ]]; then
      launcher_state="stale_pids=$alive/3"
    fi
    echo "[matrix-sdk-cluster] status=up pids=$pids validators=$vcount faucet=$faucet_state $launcher_state"
    return 0
  fi

  echo "[matrix-sdk-cluster] status=degraded alive=$alive pids=$pids validators=$vcount min_validators=$MATRIX_MIN_VALIDATORS faucet=$faucet_state"
  return 1
}

cmd="${1:-status}"
case "$cmd" in
  start) start_cluster ;;
  stop) stop_cluster ; echo "[matrix-sdk-cluster] stopped" ;;
  status) status_cluster ;;
  restart) stop_cluster; start_cluster ;;
  *)
    echo "usage: $0 {start|stop|status|restart}"
    exit 2
    ;;
esac
