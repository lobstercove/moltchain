#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Local Multi-Validator Test
# ═══════════════════════════════════════════════════════════════
# Uses run-validator.sh — the SAME script used 2000+ times locally.
#
# Port assignments (from run-validator.sh):
#   V1: p2p=7001  rpc=8899  ws=8900
#   V2: p2p=7002  rpc=8901  ws=8902
#   V3: p2p=7003  rpc=8903  ws=8904
#
# Data dirs: $REPO_ROOT/data/state-{port}
#
# Usage: bash tests/local-multi-validator-test.sh [max_validators]
#   Default: 3 validators.
# Reuse mode: set LICHEN_REUSE_EXISTING_CLUSTER=1 to validate a healthy
# already-running local cluster without flushing state or killing validators.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

# Disable pagers to prevent interactive hangs in CI/automated runs
export PAGER=cat
export GIT_PAGER=cat
export LESS='-FRX'

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAX_VALIDATORS="${1:-3}"
WARMUP_SLOTS=100  # Must match ACTIVATION_WARMUP in validator/src/main.rs
REUSE_EXISTING_CLUSTER="${LICHEN_REUSE_EXISTING_CLUSTER:-0}"
REUSE_HEALTH_TIMEOUT_SECS="${LICHEN_REUSE_HEALTH_TIMEOUT_SECS:-120}"
USING_EXISTING_CLUSTER=false

export LICHEN_LOCAL_DEV=1

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${CYAN}[TEST]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

stop_local_processes() {
    if [[ -x "$REPO_ROOT/scripts/stop-local-stack.sh" ]]; then
        "$REPO_ROOT/scripts/stop-local-stack.sh" testnet >/dev/null 2>&1 || true
    fi

    pkill -f "validator-supervisor.sh" 2>/dev/null || true
    pkill -f "run-validator.sh testnet" 2>/dev/null || true
    pkill -f "lichen-validator" 2>/dev/null || true
    pkill -f "lichen-custody" 2>/dev/null || true
    pkill -f "lichen-faucet" 2>/dev/null || true
    pkill -f "first-boot-deploy.sh" 2>/dev/null || true
    sleep 2
}

# Port calculations (must match run-validator.sh)
p2p_port()  { echo $((7000 + $1)); }
rpc_port()  { echo $((8899 + 2 * ($1 - 1))); }
db_path()   { echo "$REPO_ROOT/data/state-$(p2p_port $1)"; }
log_path()  { echo "/tmp/lichen-testnet/v${1}.log"; }

cleanup() {
    if [[ "$USING_EXISTING_CLUSTER" == "true" ]]; then
        log "Reused existing cluster — skipping cleanup"
        return
    fi

    log "Cleaning up..."
    stop_local_processes
    log "Cleanup done"
}
trap cleanup EXIT

# ── Preflight ──
[[ -x "$REPO_ROOT/target/release/lichen-validator" ]] || fail "Build first: cargo build --release"
[[ -x "$REPO_ROOT/run-validator.sh" ]] || fail "run-validator.sh not found"

# ── RPC helpers ──
rpc_query() {
    local port=$1 method=$2
    curl -sf --max-time 3 "http://127.0.0.1:${port}" -X POST \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"${method}\"}" 2>/dev/null || echo '{}'
}

get_slot() {
    rpc_query "$1" "getSlot" | python3 -c "import json,sys; print(json.load(sys.stdin).get('result',0))" 2>/dev/null || echo 0
}

get_validator_count() {
    rpc_query "$1" "getValidators" | python3 -c "import json,sys; r=json.load(sys.stdin).get('result',{}); print(len(r.get('validators',[])) if isinstance(r,dict) else 0)" 2>/dev/null || echo 0
}

# Count validators with actual stake (not just P2P routing entries with 0 stake)
get_staked_validator_count() {
    rpc_query "$1" "getValidators" | python3 -c "
import json,sys
try:
    r=json.load(sys.stdin).get('result',{})
    vs=r.get('validators',[]) if isinstance(r,dict) else []
    print(len([v for v in vs if v.get('stake',0) > 0]))
except: print(0)
" 2>/dev/null || echo 0
}

cluster_log_path() {
    local validator_num=$1
    local local_stack_log="/tmp/lichen-local-testnet/validator-${validator_num}.log"
    local harness_log
    harness_log="$(log_path "$validator_num")"
    if [[ -f "$local_stack_log" ]]; then
        echo "$local_stack_log"
    else
        echo "$harness_log"
    fi
}

existing_cluster_status_line() {
    local primary_rpc
    primary_rpc="$(rpc_port 1)"
    local statuses=()

    for n in $(seq 1 "$MAX_VALIDATORS"); do
        local rpc health status
        rpc="$(rpc_port "$n")"
        health="$(rpc_query "$rpc" "getHealth")"
        status="$(echo "$health" | python3 -c '
import json
import sys

try:
    result = json.load(sys.stdin).get("result", {})
    if isinstance(result, dict):
        print(result.get("status", "unknown"))
    else:
        print(result)
except Exception:
    print("unreachable")
')"
        statuses+=("V${n}=${status:-unreachable}")
    done

    local staked
    staked="$(get_staked_validator_count "$primary_rpc")"
    echo "${statuses[*]} staked=${staked}/${MAX_VALIDATORS}"
}

wait_for_existing_cluster_healthy() {
    local timeout_seconds=${1:-$REUSE_HEALTH_TIMEOUT_SECS}

    for second in $(seq 1 "$timeout_seconds"); do
        if existing_cluster_healthy; then
            return 0
        fi

        if [[ $((second % 5)) -eq 0 ]]; then
            log "Waiting for existing-cluster readiness: $(existing_cluster_status_line)"
        fi

        sleep 1
    done

    return 1
}

existing_cluster_healthy() {
    local primary_rpc
    primary_rpc="$(rpc_port 1)"

    for n in $(seq 1 "$MAX_VALIDATORS"); do
        local rpc health
        rpc="$(rpc_port "$n")"
        health="$(rpc_query "$rpc" "getHealth")"
        echo "$health" | python3 -c "
import json,sys
try:
    result=json.load(sys.stdin).get('result', {})
    status=result.get('status') if isinstance(result, dict) else result
    raise SystemExit(0 if status == 'ok' else 1)
except Exception:
    raise SystemExit(1)
" >/dev/null 2>&1 || return 1
    done

    [[ "$(get_staked_validator_count "$primary_rpc")" -ge "$MAX_VALIDATORS" ]]
}

load_existing_cluster_pubkeys() {
    local primary_rpc=$1

    ALL_PUBKEYS=()
    while IFS= read -r pubkey; do
        [[ -n "$pubkey" ]] && ALL_PUBKEYS+=("$pubkey")
    done < <(rpc_query "$primary_rpc" "getValidators" | python3 -c '
import json
import sys

limit = int(sys.argv[1])
result = json.load(sys.stdin).get("result", {})
validators = result.get("validators", []) if isinstance(result, dict) else []
staked = [validator for validator in validators if validator.get("stake", 0) > 0][:limit]
for validator in staked:
    pubkey = validator.get("pubkey")
    if pubkey:
        print(pubkey)
' "$MAX_VALIDATORS")

    [[ "${#ALL_PUBKEYS[@]}" -ge "$MAX_VALIDATORS" ]]
}

validator_activity_lines() {
    local primary_rpc=$1

    rpc_query "$primary_rpc" "getValidators" | python3 -c '
import json
import sys

limit = int(sys.argv[1])
result = json.load(sys.stdin).get("result", {})
validators = result.get("validators", []) if isinstance(result, dict) else []
staked = [validator for validator in validators if validator.get("stake", 0) > 0][:limit]
for validator in staked:
    produced = validator.get("blocks_proposed", validator.get("_blocks_produced", 0))
    votes = validator.get("votes_cast", 0)
    last_active = validator.get("last_active_slot", 0)
    print("{}|{}|{}|{}".format(validator.get("pubkey", ""), produced, votes, last_active))
' "$MAX_VALIDATORS"
}

verify_chain_producing() {
    local label=$1 rpc=$2 seconds=${3:-10}
    log "Verifying chain produces blocks ($label)..."
    local s1 s2 diff
    s1=$(get_slot "$rpc")
    sleep "$seconds"
    s2=$(get_slot "$rpc")
    diff=$((s2 - s1))
    if [[ "$diff" -lt 2 ]]; then
        for n in $(seq 1 "$MAX_VALIDATORS"); do
            local lp
            lp="$(log_path $n)"
            [[ -f "$lp" ]] && { warn "V${n} log tail:"; tail -20 "$lp"; }
        done
        fail "Chain stalled ($label)! Only $diff blocks in ${seconds}s (slot $s1 → $s2)"
    fi
    ok "Chain alive ($label): $diff blocks in ${seconds}s (slot $s1 → $s2)"
}

report_reused_cluster() {
    local primary_rpc
    primary_rpc="$(rpc_port 1)"
    local pass=true
    local activity_lines_found=0

    log "Reusing existing local cluster on RPC ports $(rpc_port 1), $(rpc_port 2), $(rpc_port 3)"

    if ! load_existing_cluster_pubkeys "$primary_rpc"; then
        fail "Could not load $MAX_VALIDATORS staked validator pubkeys from the running cluster"
    fi

    for n in $(seq 1 "$MAX_VALIDATORS"); do
        verify_chain_producing "existing cluster V${n}" "$(rpc_port "$n")" 5
    done

    while IFS='|' read -r pubkey produced votes last_active; do
        [[ -n "$pubkey" ]] || continue
        activity_lines_found=$((activity_lines_found + 1))
        if [[ "$produced" -gt 0 || "$votes" -gt 0 || "$last_active" -gt 0 ]]; then
            ok "Validator $pubkey active: proposed=$produced votes=$votes last_active=$last_active"
        else
            warn "Validator $pubkey has no observed activity on the running cluster"
            pass=false
        fi
    done < <(validator_activity_lines "$primary_rpc")

    if [[ "$activity_lines_found" -lt "$MAX_VALIDATORS" ]]; then
        fail "Could not load activity stats for all $MAX_VALIDATORS validators from the running cluster"
    fi

    echo ""
    log "═══════════════════════════════════════════════════════════"
    local final_slot final_vcnt
    final_slot=$(get_slot "$primary_rpc")
    final_vcnt=$(get_validator_count "$primary_rpc")
    ok "Slot: $final_slot"
    ok "Validators: $final_vcnt"
    for v_num in $(seq 1 "$MAX_VALIDATORS"); do
        ok "  V${v_num}: ${ALL_PUBKEYS[$((v_num - 1))]}"
    done
    echo ""
    if $pass; then
        ok "═══════════════════════════════════════════════════════════"
        ok "ALL TESTS PASSED: reused running $MAX_VALIDATORS-validator cluster"
        ok "═══════════════════════════════════════════════════════════"
    else
        fail "TEST FAILED: Running cluster does not show activity for every validator"
    fi
}

if [[ "$REUSE_EXISTING_CLUSTER" == "1" ]]; then
    if wait_for_existing_cluster_healthy "$REUSE_HEALTH_TIMEOUT_SECS"; then
        USING_EXISTING_CLUSTER=true
        declare -a ALL_PUBKEYS=()
        report_reused_cluster
        exit 0
    fi

    warn "Existing-cluster reuse never became healthy: $(existing_cluster_status_line)"
    for n in $(seq 1 "$MAX_VALIDATORS"); do
        local_log="$(cluster_log_path "$n")"
        if [[ -f "$local_log" ]]; then
            warn "V${n} log tail (${local_log}):"
            tail -20 "$local_log"
        fi
    done
    fail "Requested existing-cluster reuse, but the local stack did not become healthy within ${REUSE_HEALTH_TIMEOUT_SECS}s"
fi

# ═══════════════════════════════════════════════════════════════
# FLUSH: Clean all local state
# ═══════════════════════════════════════════════════════════════
log "Flushing local state..."
stop_local_processes
for n in $(seq 1 "$MAX_VALIDATORS"); do
    local_db="$(db_path $n)"
    if [[ -d "$local_db" ]]; then
        rm -rf "$local_db"
        log "  Flushed $local_db"
    fi
done
mkdir -p /tmp/lichen-testnet
ok "State flushed"

# ═══════════════════════════════════════════════════════════════
# PHASE 1: Start V1 (genesis)
# ═══════════════════════════════════════════════════════════════
log "═══════════════════════════════════════════════════════════"
log "PHASE 1: Starting V1 (genesis validator)"
log "═══════════════════════════════════════════════════════════"

V1_RPC=$(rpc_port 1)
V1_LOG="$(log_path 1)"

LICHEN_DISABLE_SUPERVISOR=1 "$REPO_ROOT/run-validator.sh" testnet 1 \
    > "$V1_LOG" 2>&1 &
V1_PID=$!
log "V1 started (PID: $V1_PID)"

# Wait for V1 to produce blocks
log "Waiting for V1 to produce blocks..."
for i in $(seq 1 60); do
    sleep 2
    if ! kill -0 $V1_PID 2>/dev/null; then
        warn "V1 crashed! Log tail:"
        tail -30 "$V1_LOG"
        fail "V1 crashed during startup"
    fi
    SLOT=$(get_slot $V1_RPC)
    if [[ "$SLOT" -gt 3 ]]; then
        ok "V1 producing blocks! Slot: $SLOT"
        break
    fi
    [[ $i -lt 60 ]] || fail "V1 failed to produce blocks after 120s"
done

# Wait for V1 keypair to exist
for w in $(seq 1 10); do
    [[ -f "$(db_path 1)/validator-keypair.json" ]] && break
    sleep 1
done

# Extract V1 pubkey
V1_PUBKEY=$(grep -m1 '"publicKeyBase58"' "$(db_path 1)/validator-keypair.json" \
    | sed -E 's/.*"publicKeyBase58"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
ok "V1 pubkey: $V1_PUBKEY"

VCNT=$(get_validator_count $V1_RPC)
SLOT=$(get_slot $V1_RPC)
ok "Phase 1 complete: validators=$VCNT, slot=$SLOT"

if [[ "$VCNT" -ne 1 ]]; then
    warn "Expected 1 validator at genesis, got $VCNT"
    warn "This means the local node is leaking to production seeds!"
    fail "Validator count mismatch — check seeds.json isolation"
fi

if [[ "$MAX_VALIDATORS" -lt 2 ]]; then
    ok "PASS: Single validator test complete"
    exit 0
fi

# ═══════════════════════════════════════════════════════════════
# PHASE 2+: Add joining validators
# ═══════════════════════════════════════════════════════════════
declare -a ALL_PUBKEYS=("$V1_PUBKEY")

for V_NUM in $(seq 2 "$MAX_VALIDATORS"); do
    log "═══════════════════════════════════════════════════════════"
    log "PHASE ${V_NUM}: Adding V${V_NUM} to network"
    log "═══════════════════════════════════════════════════════════"

    V_RPC=$(rpc_port $V_NUM)
    V_LOG="$(log_path $V_NUM)"

    LICHEN_DISABLE_SUPERVISOR=1 "$REPO_ROOT/run-validator.sh" testnet "$V_NUM" \
        > "$V_LOG" 2>&1 &
    V_PID=$!
    log "V${V_NUM} started (PID: $V_PID)"

    # Wait for keypair file to be created
    V_KEYPAIR="$(db_path $V_NUM)/validator-keypair.json"
    for w in $(seq 1 30); do
        [[ -f "$V_KEYPAIR" ]] && break
        sleep 1
    done
    V_PUBKEY=$(grep -m1 '"publicKeyBase58"' "$V_KEYPAIR" 2>/dev/null \
        | sed -E 's/.*"publicKeyBase58"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' || echo "")

    if [[ -z "$V_PUBKEY" ]]; then
        fail "Could not extract V${V_NUM} pubkey"
    fi

    # Verify unique
    for existing in "${ALL_PUBKEYS[@]}"; do
        if [[ "$existing" == "$V_PUBKEY" ]]; then
            fail "V${V_NUM} has DUPLICATE pubkey $V_PUBKEY!"
        fi
    done
    ALL_PUBKEYS+=("$V_PUBKEY")
    ok "V${V_NUM} pubkey: $V_PUBKEY (unique)"

    # Wait for registration (staked, not just P2P routing entry)
    log "Waiting for V${V_NUM} to sync and register (with stake)..."
    REGISTERED=false
    REG_SLOT=0
    for i in $(seq 1 300); do
        sleep 2

        if ! kill -0 $V_PID 2>/dev/null; then
            warn "V${V_NUM} crashed! Log tail:"
            tail -30 "$V_LOG"
            fail "V${V_NUM} crashed"
        fi

        # Use STAKED count — validators with actual bootstrap grant, not routing entries
        STAKED_CNT=$(get_staked_validator_count $V1_RPC)
        VCNT=$(get_validator_count $V1_RPC)
        if [[ "$STAKED_CNT" -ge "$V_NUM" ]] && ! $REGISTERED; then
            REG_SLOT=$(get_slot $V1_RPC)
            ok "V${V_NUM} registered at slot ~$REG_SLOT! Staked: $STAKED_CNT, Routing: $VCNT"
            REGISTERED=true
            break
        fi

        # Progress every 30s
        if [[ $((i % 15)) -eq 0 ]]; then
            V_SLOT=$(get_slot $V_RPC)
            NET_SLOT=$(get_slot $V1_RPC)
            log "  V${V_NUM} slot=$V_SLOT network=$NET_SLOT staked=$STAKED_CNT routing=$VCNT"
        fi

        [[ $i -lt 300 ]] || {
            warn "V${V_NUM} log tail:"
            tail -40 "$V_LOG"
            fail "V${V_NUM} did not register after 600s"
        }
    done

    # Verify chain didn't stall
    verify_chain_producing "during V${V_NUM} registration" "$V1_RPC" 10

    # Wait for activation warmup (500 slots after registration)
    ACTIVATION_SLOT=$((REG_SLOT + WARMUP_SLOTS + 10))
    log "Waiting for warmup: activation after slot ~$ACTIVATION_SLOT..."
    for i in $(seq 1 600); do
        sleep 1
        NET_SLOT=$(get_slot $V1_RPC)
        if [[ "$NET_SLOT" -ge "$ACTIVATION_SLOT" ]]; then
            ok "Warmup done! Slot $NET_SLOT >= $ACTIVATION_SLOT"
            break
        fi
        if [[ $((i % 30)) -eq 0 ]]; then
            log "  Warmup: slot $NET_SLOT / $ACTIVATION_SLOT"
        fi
        if ! kill -0 $V_PID 2>/dev/null; then
            warn "V${V_NUM} crashed during warmup! Log tail:"
            tail -30 "$V_LOG"
            fail "V${V_NUM} crashed during warmup"
        fi
        [[ $i -lt 600 ]] || fail "Warmup exceeded 600s (slot $NET_SLOT / $ACTIVATION_SLOT)"
    done

    verify_chain_producing "V${V_NUM} post-activation" "$V1_RPC" 15

    ok "PHASE ${V_NUM} PASSED"
done

# ═══════════════════════════════════════════════════════════════
# FINAL: Verify ALL validators produce blocks
# ═══════════════════════════════════════════════════════════════
echo ""
log "═══════════════════════════════════════════════════════════"
log "FINAL: Verifying all validators produce blocks"
log "═══════════════════════════════════════════════════════════"

log "Letting network run 30s to accumulate production..."
sleep 30

PASS=true
for V_NUM in $(seq 1 "$MAX_VALIDATORS"); do
    V_PUBKEY="${ALL_PUBKEYS[$((V_NUM - 1))]}"
    V_LOG="$(log_path $V_NUM)"

    PRODUCED=$(/usr/bin/grep -c "Produced block" "$V_LOG" 2>/dev/null || true)
    PRODUCED="${PRODUCED:-0}"

    if [[ "$PRODUCED" -gt 0 ]]; then
        ok "V${V_NUM} ($V_PUBKEY): produced=$PRODUCED blocks"
    else
        # Check if V1 saw blocks from this validator
        PROPOSED=$(grep "proposer=$V_PUBKEY" "$(log_path 1)" 2>/dev/null | wc -l | tr -d ' ')
        if [[ "$PROPOSED" -gt 0 ]]; then
            ok "V${V_NUM} ($V_PUBKEY): proposed=$PROPOSED blocks (seen on V1)"
        else
            warn "V${V_NUM} ($V_PUBKEY): produced=0, proposed=0 — NOT producing!"
            tail -20 "$V_LOG"
            PASS=false
        fi
    fi
done

# ═══════════════════════════════════════════════════════════════
# REPORT
# ═══════════════════════════════════════════════════════════════
echo ""
log "═══════════════════════════════════════════════════════════"
FINAL_SLOT=$(get_slot $V1_RPC)
FINAL_VCNT=$(get_validator_count $V1_RPC)
ok "Slot: $FINAL_SLOT"
ok "Validators: $FINAL_VCNT"
for V_NUM in $(seq 1 "$MAX_VALIDATORS"); do
    ok "  V${V_NUM}: ${ALL_PUBKEYS[$((V_NUM - 1))]}"
done
echo ""
if $PASS; then
    ok "═══════════════════════════════════════════════════════════"
    ok "ALL TESTS PASSED: $MAX_VALIDATORS validators, ALL producing"
    ok "═══════════════════════════════════════════════════════════"
else
    fail "TEST FAILED: Not all validators are producing blocks!"
fi
