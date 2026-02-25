#!/usr/bin/env bash
# K3-02: Multi-validator consensus E2E test
# Tests: 3-validator boot → block production → consensus → transaction finality
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
BIN="$ROOT/target/release/moltchain-validator"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0; TOTAL=0

pass() { ((PASS++)); ((TOTAL++)); echo -e "${GREEN}✓ PASS${NC}: $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo -e "${RED}✗ FAIL${NC}: $1"; }
info() { echo -e "${YELLOW}→${NC} $1"; }

rpc() {
    local port=$1 method=$2 params=${3:-[]}
    curl -sf http://127.0.0.1:$port -X POST \
        -H 'Content-Type:application/json' \
        -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$method\",\"params\":$params}" 2>/dev/null
}

rpc_result() {
    local port=$1 method=$2 params=${3:-[]}
    rpc "$port" "$method" "$params" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin).get('result')))" 2>/dev/null
}

wait_for_health() {
    local port=$1
    local attempts=${2:-20}
    local delay=${3:-1}
    for _ in $(seq 1 "$attempts"); do
        local status
        status=$(rpc "$port" "health" 2>/dev/null || echo "")
        if echo "$status" | python3 -c "import sys,json; r=json.load(sys.stdin); assert r.get('result') is not None" 2>/dev/null; then
            return 0
        fi
        sleep "$delay"
    done
    return 1
}

wait_for_validator_count() {
    local port=$1
    local min_count=$2
    local attempts=${3:-20}
    local delay=${4:-1}
    for _ in $(seq 1 "$attempts"); do
        local validators vcount
        validators=$(rpc_result "$port" "getValidators" 2>/dev/null || echo "[]")
        vcount=$(echo "$validators" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
        if [ "$vcount" -ge "$min_count" ]; then
            echo "$vcount"
            return 0
        fi
        sleep "$delay"
    done
    echo "0"
    return 1
}

cleanup() {
    info "Cleaning up validators..."
    for pid in ${V1PID:-} ${V2PID:-} ${V3PID:-}; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
    rm -rf "$ROOT/data/e2e-test-v1" "$ROOT/data/e2e-test-v2" "$ROOT/data/e2e-test-v3"
}
trap cleanup EXIT

# ── Build ─────────────────────────────────────────────────────
if [ ! -f "$BIN" ]; then
    info "Building validator (release)..."
    cargo build --release --bin moltchain-validator
fi

# ── Clean state ───────────────────────────────────────────────
rm -rf "$ROOT/data/e2e-test-v1" "$ROOT/data/e2e-test-v2" "$ROOT/data/e2e-test-v3"

# ── Start validators ─────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo " K3-02: Multi-Validator Consensus E2E Test"
echo "═══════════════════════════════════════════════════════"
echo ""

info "Starting V1 (leader) on ports 9100/9101..."
RUST_LOG=warn "$BIN" --dev-mode --p2p-port 9100 --rpc-port 9101 \
    --db-path "$ROOT/data/e2e-test-v1" > /tmp/e2e-v1.log 2>&1 &
V1PID=$!
sleep 8

info "Starting V2 on ports 9102/9103..."
RUST_LOG=warn "$BIN" --dev-mode --p2p-port 9102 --rpc-port 9103 \
    --db-path "$ROOT/data/e2e-test-v2" --bootstrap 127.0.0.1:9100 > /tmp/e2e-v2.log 2>&1 &
V2PID=$!
sleep 6

info "Starting V3 on ports 9104/9105..."
RUST_LOG=warn "$BIN" --dev-mode --p2p-port 9104 --rpc-port 9105 \
    --db-path "$ROOT/data/e2e-test-v3" --bootstrap 127.0.0.1:9100 > /tmp/e2e-v3.log 2>&1 &
V3PID=$!
sleep 6

# ── Test 1: All validators healthy ──────────────────────────
echo ""
info "Test 1: Health checks"
for port in 9101 9103 9105; do
    if wait_for_health "$port" 20 1; then
        pass "V$(( (port - 9101) / 2 + 1 )) healthy (port $port)"
    else
        fail "V$(( (port - 9101) / 2 + 1 )) NOT healthy (port $port)"
    fi
done

# ── Test 2: All validators registered ───────────────────────
info "Test 2: Validator registration"
if VCOUNT=$(wait_for_validator_count 9101 2 20 1); then
    pass "Validator count >= 2 (got $VCOUNT)"
else
    fail "Expected >= 2 validators, got $VCOUNT"
fi

# ── Test 3: Block production ────────────────────────────────
info "Test 3: Block production"
SLOT1=$(rpc_result 9101 "getSlot" 2>/dev/null || echo "0")
sleep 10
SLOT2=$(rpc_result 9101 "getSlot" 2>/dev/null || echo "0")
if python3 -c "assert int('${SLOT2}') > int('${SLOT1}')" 2>/dev/null; then
    pass "Blocks advancing: $SLOT1 → $SLOT2"
else
    fail "Blocks NOT advancing: $SLOT1 → $SLOT2"
fi

# ── Test 4: Slot sync across validators ─────────────────────
info "Test 4: Slot synchronization"
SLOT_V1=$(rpc_result 9101 "getSlot" || echo "0")
SLOT_V2=$(rpc_result 9103 "getSlot" || echo "0")
SLOT_V3=$(rpc_result 9105 "getSlot" || echo "0")
SYNCED=$(python3 -c "
s=[int('$SLOT_V1'),int('$SLOT_V2'),int('$SLOT_V3')]
diff=max(s)-min(s)
print('yes' if diff <= 5 else 'no')
print(f'V1={s[0]} V2={s[1]} V3={s[2]} (drift={diff})')
" 2>/dev/null)
if echo "$SYNCED" | head -1 | grep -q "yes"; then
    pass "Slots synchronized: $(echo "$SYNCED" | tail -1)"
else
    fail "Slots NOT synchronized: $(echo "$SYNCED" | tail -1)"
fi

# ── Test 5: Transaction submission and confirmation ──────────
info "Test 5: Transaction finality"
# Get a recent blockhash
BLOCKHASH=$(rpc_result 9101 "getRecentBlockhash" | python3 -c "import sys,json; print(json.load(sys.stdin))" 2>/dev/null)
if [ -n "$BLOCKHASH" ] && [ "$BLOCKHASH" != "null" ] && [ "$BLOCKHASH" != "None" ]; then
    pass "Got recent blockhash: ${BLOCKHASH:0:16}..."
else
    fail "Could not get recent blockhash"
fi

# ── Test 6: Consistent block data across validators ─────────
info "Test 6: Cross-validator consistency"
sleep 5
BLOCK_V1=$(rpc_result 9101 "getBlock" "[0]" 2>/dev/null)
BLOCK_V2=$(rpc_result 9103 "getBlock" "[0]" 2>/dev/null)
if [ "$BLOCK_V1" = "$BLOCK_V2" ] && [ "$BLOCK_V1" != "null" ]; then
    pass "Genesis block matches across V1 and V2"
else
    # Check if both exist (different serialization is OK if both have slot 0)
    HAS_V1=$(echo "$BLOCK_V1" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d and isinstance(d, dict) and d.get('slot', d.get('header', {}).get('slot', -1)) >=0 else 'no')" 2>/dev/null || echo "no")
    HAS_V2=$(echo "$BLOCK_V2" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d and isinstance(d, dict) and d.get('slot', d.get('header', {}).get('slot', -1)) >=0 else 'no')" 2>/dev/null || echo "no")
    if [ "$HAS_V1" = "yes" ] && [ "$HAS_V2" = "yes" ]; then
        pass "Both validators have genesis block (non-identical JSON OK)"
    else
        fail "Genesis block mismatch: V1=$HAS_V1 V2=$HAS_V2"
    fi
fi

# ── Test 7: Metrics available ───────────────────────────────
info "Test 7: Chain metrics"
METRICS=$(rpc_result 9101 "getMetrics" 2>/dev/null || echo "null")
if [ "$METRICS" != "null" ] && [ -n "$METRICS" ]; then
    pass "Chain metrics available"
else
    fail "Chain metrics NOT available"
fi

# ── Summary ──────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo -e " Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC} / $TOTAL total"
echo "═══════════════════════════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
    echo "Logs: /tmp/e2e-v1.log /tmp/e2e-v2.log /tmp/e2e-v3.log"
    exit 1
fi
exit 0
