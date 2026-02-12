#!/bin/bash

# MoltChain Full Reset Script
# Stops all validators, clears ALL state data, and optionally restarts
# Usage: ./reset-and-restart.sh [network] [--no-restart]
#   network: testnet | mainnet (default: testnet)
#   --no-restart: Only reset, don't restart validators

NETWORK=${1:-testnet}
NO_RESTART=false

for arg in "$@"; do
  case $arg in
    --no-restart) NO_RESTART=true ;;
  esac
done

NETWORK=$(echo "$NETWORK" | tr '[:upper:]' '[:lower:]')

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="${SCRIPT_DIR}/../.."
cd "$REPO_ROOT" || exit 1

echo "============================================"
echo "  MoltChain Full Reset"
echo "  Network: $NETWORK"
echo "============================================"
echo ""

# Step 1: Kill all running validators
echo "1. Stopping all running validators..."
pkill -f "moltchain-validator" 2>/dev/null && echo "   Killed running validators" || echo "   No validators running"
pkill -f "moltchain-faucet" 2>/dev/null && echo "   Killed running faucet" || echo "   No faucet running"
sleep 1

# Step 2: Clear ALL state data
echo ""
echo "2. Clearing state data..."

case $NETWORK in
  testnet)
    PORTS=(7001 7002 7003)
    ;;
  mainnet)
    PORTS=(8001 8002 8003)
    ;;
  *)
    echo "Unknown network: $NETWORK"
    exit 1
    ;;
esac

for PORT in "${PORTS[@]}"; do
  DB_PATH="./data/state-${NETWORK}-${PORT}"
  if [ -d "$DB_PATH" ]; then
    rm -rf "$DB_PATH"
    echo "   Removed $DB_PATH"
  else
    echo "   $DB_PATH not found (already clean)"
  fi
done

# Also clean any generic state dirs
for DIR in ./data/state-*; do
  if [ -d "$DIR" ]; then
    rm -rf "$DIR"
    echo "   Removed $DIR"
  fi
done

echo ""
echo "3. State fully cleared."

if [ "$NO_RESTART" = true ]; then
  echo ""
  echo "Reset complete. Use run-validator.sh to start validators."
  exit 0
fi

# Step 3: Restart validators
echo ""
echo "4. Starting validators..."
echo ""

LAUNCHER="$SCRIPT_DIR/run-validator.sh"

echo "   Starting V1 (primary)..."
nohup "$LAUNCHER" "$NETWORK" 1 > /tmp/moltchain-v1.log 2>&1 &
V1_PID=$!
echo "   V1 PID: $V1_PID"

# Wait for V1 to bootstrap and produce genesis
echo "   Waiting for V1 to initialize (8s)..."
sleep 8

echo "   Starting V2 (secondary)..."
nohup "$LAUNCHER" "$NETWORK" 2 > /tmp/moltchain-v2.log 2>&1 &
V2_PID=$!
echo "   V2 PID: $V2_PID"

sleep 3

echo "   Starting V3 (tertiary)..."
nohup "$LAUNCHER" "$NETWORK" 3 > /tmp/moltchain-v3.log 2>&1 &
V3_PID=$!
echo "   V3 PID: $V3_PID"

echo ""
echo "5. Waiting for stake pool sync (10s)..."
sleep 10

# Step 4: Verify
echo ""
echo "6. Verification:"
echo ""

# Check V1 RPC
V1_RPC=$(curl -s http://localhost:8899 -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getValidators","params":[]}' 2>/dev/null)

if echo "$V1_RPC" | grep -q "pubkey"; then
  VCOUNT=$(echo "$V1_RPC" | grep -o '"pubkey"' | wc -l | tr -d ' ')
  echo "   V1 RPC: OK ($VCOUNT validators visible)"
else
  echo "   V1 RPC: Not responding yet (check /tmp/moltchain-v1.log)"
fi

# Check balances
for PUBKEY_LABEL in "V1:4y43skFVWzrpiEL5HNk7DtRgPYkbkuPqvqWDN9onFtBT" "V2:UqJ2s9YuAJNKQEidxGnA5Sjg78yPuRKnRjeMXCFsFVT" "V3:2au9WbFw6E4ca3Zd114BA35FQMfAQc4xnpBLpFBMgbc6"; do
  LABEL=$(echo "$PUBKEY_LABEL" | cut -d: -f1)
  PUBKEY=$(echo "$PUBKEY_LABEL" | cut -d: -f2)
  BAL=$(curl -s http://localhost:8899 -X POST -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getBalance\",\"params\":[\"$PUBKEY\"]}" 2>/dev/null)
  STAKED=$(echo "$BAL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('staked_molt','?'))" 2>/dev/null || echo "?")
  SPEND=$(echo "$BAL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('spendable_molt','?'))" 2>/dev/null || echo "?")
  echo "   $LABEL: staked=$STAKED, spendable=$SPEND"
done

echo ""
echo "============================================"
echo "  Reset + Restart Complete"
echo "  Logs: /tmp/moltchain-v{1,2,3}.log"
echo "============================================"
