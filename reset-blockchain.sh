#!/usr/bin/env bash
# ============================================================================
# MoltChain — Blockchain Reset (convenience wrapper)
# ============================================================================
#
# Wraps skills/validator/reset-blockchain.sh from repo root.
#
# Usage:
#   ./reset-blockchain.sh [testnet|mainnet|all] [--restart] [solana_rpc] [evm_rpc]
#
# Same as running: ./skills/validator/reset-blockchain.sh [args...]
#
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "${SCRIPT_DIR}/skills/validator/reset-blockchain.sh" "$@"
