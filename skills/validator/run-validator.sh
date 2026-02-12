#!/bin/bash

# MoltChain Validator Launcher
# Usage: ./run-validator.sh [network] <validator_number>
#   network: testnet | mainnet (default: testnet)

NETWORK=${1:-testnet}
VALIDATOR_NUM=${2:-1}

if [[ "$NETWORK" =~ ^[0-9]+$ ]]; then
  VALIDATOR_NUM=$NETWORK
  NETWORK=testnet
fi

NETWORK=$(echo "$NETWORK" | tr '[:upper:]' '[:lower:]')
NETWORK_UPPER=$(echo "$NETWORK" | tr '[:lower:]' '[:upper:]')

case $NETWORK in
  testnet)
    BASE_RPC=8899
    BASE_WS=8900
    BASE_P2P=7001
    ;;
  mainnet)
    BASE_RPC=9899
    BASE_WS=9900
    BASE_P2P=8001
    ;;
  *)
    echo "Usage: $0 [testnet|mainnet] <1|2|3>"
    exit 1
    ;;
esac

if ! [[ "$VALIDATOR_NUM" =~ ^[1-3]$ ]]; then
  echo "Usage: $0 [testnet|mainnet] <1|2|3>"
  exit 1
fi
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="${SCRIPT_DIR}/../.."
cd "$REPO_ROOT" || exit 1

RPC_PORT=$((BASE_RPC - (VALIDATOR_NUM - 1)))
WS_PORT=$((BASE_WS + (VALIDATOR_NUM - 1)))
P2P_PORT=$((BASE_P2P + (VALIDATOR_NUM - 1)))
SIGNER_PORT=$((9200 + VALIDATOR_NUM))
DB_PATH="./data/state-${NETWORK}-${P2P_PORT}"

case $VALIDATOR_NUM in
  1)
    NAME="${NETWORK_UPPER}-V1-PRIMARY"
    ;;
  2)
    NAME="${NETWORK_UPPER}-V2-SECONDARY"
    BOOTSTRAP="--bootstrap-peers 127.0.0.1:${BASE_P2P}"
    ;;
  3)
    NAME="${NETWORK_UPPER}-V3-TERTIARY"
    BOOTSTRAP="--bootstrap-peers 127.0.0.1:${BASE_P2P}"
    ;;
esac

echo "🦞 Starting MoltChain Validator: $NAME"
echo "=================================="
echo "Network: $NETWORK"
echo "RPC:  http://localhost:$RPC_PORT"
echo "WS:   ws://localhost:$WS_PORT"
echo "P2P:  0.0.0.0:$P2P_PORT"
echo "Signer: http://localhost:$SIGNER_PORT"
echo "DB:   $DB_PATH"
echo ""

if [ "$VALIDATOR_NUM" = "1" ]; then
  echo "🎯 This is the PRIMARY validator (genesis)"
else
  echo "🔗 Bootstrapping from: 127.0.0.1:$BASE_P2P"
fi

echo ""
echo "📊 Adaptive Block Production:"
echo "   • No TXs: Heartbeat every 5s (0.027 MOLT)"
echo "   • With TXs: 400ms blocks (0.18 MOLT)"
echo ""

if [ -z "${MOLTCHAIN_SIGNER_BIND:-}" ]; then
  export MOLTCHAIN_SIGNER_BIND="0.0.0.0:${SIGNER_PORT}"
fi

BIN_PATH="./target/release/moltchain-validator"
if [ -x "$BIN_PATH" ]; then
  "$BIN_PATH" \
    --network $NETWORK \
    --rpc-port $RPC_PORT \
    --ws-port $WS_PORT \
    --p2p-port $P2P_PORT \
    --db-path $DB_PATH \
    $BOOTSTRAP
else
  cargo run --release --bin moltchain-validator -- \
    --network $NETWORK \
    --rpc-port $RPC_PORT \
    --ws-port $WS_PORT \
    --p2p-port $P2P_PORT \
    --db-path $DB_PATH \
    $BOOTSTRAP
fi
