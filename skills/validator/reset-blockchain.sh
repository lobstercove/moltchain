#!/bin/bash

# MoltChain - Reset Blockchain Script
# Clears all state and prepares for fresh genesis
# Usage: ./reset-blockchain.sh [testnet|mainnet|all] [--restart] [solana_rpc] [evm_rpc]

NETWORK=${1:-all}
RESTART=false
SOLANA_RPC_URL=""
EVM_RPC_URL=""

for arg in "$@"; do
    if [ "$arg" = "--restart" ]; then
        RESTART=true
    fi
done

if [[ "$NETWORK" == "--restart" ]]; then
    NETWORK=all
fi

NETWORK=$(echo "$NETWORK" | tr '[:upper:]' '[:lower:]')

if [ "$RESTART" = true ]; then
    for arg in "$@"; do
        case "$arg" in
            --restart|$NETWORK)
                ;;
            *)
                if [ -z "$SOLANA_RPC_URL" ]; then
                    SOLANA_RPC_URL="$arg"
                elif [ -z "$EVM_RPC_URL" ]; then
                    EVM_RPC_URL="$arg"
                fi
                ;;
        esac
    done
fi

case $NETWORK in
    all|testnet|mainnet)
        ;;
    *)
        echo "Usage: $0 [testnet|mainnet|all] [--restart] [solana_rpc] [evm_rpc]"
        exit 1
        ;;
esac

if [ "$RESTART" = true ] && [ "$NETWORK" = "all" ]; then
    echo "❌ --restart requires an explicit network (testnet or mainnet)"
    exit 1
fi

echo "🦞 MoltChain Blockchain Reset"
echo "=============================="
echo ""

echo "🛑 Stopping validators..."
LOG_DIR="/tmp/moltchain-local-${NETWORK}"
if [ "$NETWORK" != "all" ] && [ -d "$LOG_DIR" ]; then
    echo "   Logs: $LOG_DIR"
fi
if [ "$NETWORK" = "all" ]; then
    pkill -9 -f "target/debug/moltchain-validator" || true
    pkill -9 -f "target/release/moltchain-validator" || true
    pkill -9 -f "moltchain-custody" || true
    sleep 3

    if pgrep -f "moltchain-validator" > /dev/null; then
        echo "   ⚠️  Some validators still running, waiting..."
        sleep 3
        pkill -9 -f "moltchain-validator" || true
        sleep 2
    fi

    if pgrep -f "moltchain-validator" > /dev/null; then
        echo "   ❌ Error: Cannot stop validators. Please stop manually."
        exit 1
    fi
else
    if [ "$NETWORK" = "testnet" ]; then
        PORTS=(7001 7002 7003)
    else
        PORTS=(8001 8002 8003)
    fi

    for port in "${PORTS[@]}"; do
        pkill -9 -f "moltchain-validator.*--p2p-port ${port}" || true
    done
    pkill -9 -f "moltchain-custody" || true
    sleep 2
fi
echo "   ✓ Validators stopped"

if pgrep -f "moltchain-custody" >/dev/null; then
    echo "   ⚠️  Custody still running"
else
    echo "   ✓ Custody stopped"
fi

# Remove RocksDB directories - COMPLETE RESET
echo "🗑️  Removing blockchain state..."
cd "$(dirname "$0")/../.." || exit 1  # Go to moltchain root

if [ "$NETWORK" = "all" ]; then
    rm -rf /tmp/moltchain-*
    rm -rf /tmp/validator-*
    rm -rf data/state-*
    rm -rf data/custody*
    rm -rf skills/validator/data/state-*
    rm -rf validator-* 2>/dev/null || true
    rm -rf ~/.moltchain/data-*
    rm -rf ~/.moltchain/state-*
else
    rm -rf data/state-${NETWORK}-*
    rm -rf data/custody-${NETWORK}*
    rm -rf skills/validator/data/state-${NETWORK}-*
fi

echo "   ✓ RocksDB directories cleared"

if [ "$NETWORK" = "all" ]; then
    echo "🗑️  Removing old genesis..."
    if [ -f "genesis.json" ]; then
        rm -f genesis.json
        echo "   ✓ Removed genesis.json"
    fi
fi

if [ "$NETWORK" = "all" ]; then
    echo "🗑️  Removing test data..."
    rm -rf /tmp/molt*
fi

echo "🗑️  Removing peer cache..."
if [ "$NETWORK" = "all" ]; then
    find . -name "known-peers.json" -delete 2>/dev/null || true
    find ~/.moltchain -name "known-peers.json" -delete 2>/dev/null || true
else
    for dir in data/state-${NETWORK}-*; do
        if [ -d "$dir" ]; then
            find "$dir" -name "known-peers.json" -delete 2>/dev/null || true
        fi
    done
fi
echo "   ✓ Peer cache cleared"

if [ "$NETWORK" = "all" ]; then
    echo "🗑️  Removing LOCK files..."
    find /tmp -name "LOCK" -path "*/moltchain*" -delete 2>/dev/null || true
    find /tmp -name "LOCK" -path "*/validator*" -delete 2>/dev/null || true
    echo "   ✓ LOCK files cleared"
fi

echo "🔐 Clearing validator keypairs..."
if [ "$NETWORK" = "all" ]; then
    rm -rf ~/.moltchain/validators 2>/dev/null || true
    rm -f ~/.moltchain/validator-*.json 2>/dev/null || true
else
    if [ "$NETWORK" = "testnet" ]; then
        PORTS=(7001 7002 7003)
    else
        PORTS=(8001 8002 8003)
    fi

    for port in "${PORTS[@]}"; do
        rm -f "$HOME/.moltchain/validators/validator-${port}.json" 2>/dev/null || true
    done
fi
echo "   ✓ Validator keypairs cleared (will regenerate on start)"

echo "🔐 Clearing signer data..."
if [ "$NETWORK" = "all" ]; then
    rm -rf ~/.moltchain/signer-*
    rm -rf ~/.moltchain/signers
    rm -rf data/signer-*
    rm -rf data/state-*/signer-*
    rm -rf skills/validator/data/signer-*
else
    rm -rf data/state-${NETWORK}-*/signer-*
    rm -rf skills/validator/data/state-${NETWORK}-*/signer-*
fi
echo "   ✓ Signer data cleared (will regenerate on start)"

echo "🔐 Clearing genesis wallet files..."
if [ "$NETWORK" = "all" ]; then
    find /tmp -name "genesis-wallet.json" -delete 2>/dev/null || true
    find /tmp -name "genesis-keys" -type d -exec rm -rf {} + 2>/dev/null || true
    find ~/.moltchain -name "genesis-wallet.json" -delete 2>/dev/null || true
    find ~/.moltchain -name "genesis-keys" -type d -exec rm -rf {} + 2>/dev/null || true
    find data -name "genesis-wallet.json" -delete 2>/dev/null || true
    find data -name "genesis-keys" -type d -exec rm -rf {} + 2>/dev/null || true
    find skills/validator/data -name "genesis-wallet.json" -delete 2>/dev/null || true
    find skills/validator/data -name "genesis-keys" -type d -exec rm -rf {} + 2>/dev/null || true
else
    for dir in data/state-${NETWORK}-*; do
        if [ -d "$dir" ]; then
            find "$dir" -name "genesis-wallet.json" -delete 2>/dev/null || true
            find "$dir" -name "genesis-keys" -type d -exec rm -rf {} + 2>/dev/null || true
        fi
    done
fi

echo "   ✓ Genesis wallet files cleared (first validator will generate fresh)"

echo ""
echo "✅ BLOCKCHAIN RESET COMPLETE!"
echo ""
echo "📋 Next steps:"
if [ "$NETWORK" = "all" ]; then
    echo "1. Start FIRST validator: ./run-validator.sh testnet 1"
    echo "   → This will generate NEW genesis + treasury keys"
    echo "   → Genesis wallet will be in DB at validator 1's data dir"
    echo "2. Start additional validators: ./run-validator.sh testnet 2, 3, etc."
    echo "   → Will auto-sync genesis from validator 1"
    echo "   → Each gets 10,000 MOLT bootstrap grant"
else
    echo "1. Start FIRST validator: ./run-validator.sh $NETWORK 1"
    echo "   → This will generate NEW genesis + treasury keys"
    echo "   → Genesis wallet will be in DB at validator 1's data dir"
    echo "2. Start additional validators: ./run-validator.sh $NETWORK 2, 3, etc."
    echo "   → Will auto-sync genesis from validator 1"
    echo "   → Each gets 10,000 MOLT bootstrap grant"
fi
echo ""
echo "⚠️  IMPORTANT:"
echo "  • First validator generates genesis (dynamic, not static)"
echo "  • Genesis keys saved in data-dir/genesis-keys/"
echo "  • Keep those keys secure - they control 1B MOLT treasury"
echo "  • 10,000 MOLT bootstrap grant per validator"
echo "  • Adaptive heartbeat (5s idle, 400ms active)"
echo ""

if [ "$RESTART" = true ]; then
    echo "🚀 Restarting local stack..."
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    REPO_ROOT="${SCRIPT_DIR}/../.."
    if [ -n "$SOLANA_RPC_URL" ] || [ -n "$EVM_RPC_URL" ]; then
        "$REPO_ROOT/scripts/start-local-stack.sh" "$NETWORK" "$SOLANA_RPC_URL" "$EVM_RPC_URL"
    else
        "$REPO_ROOT/scripts/start-local-stack.sh" "$NETWORK"
    fi
fi
