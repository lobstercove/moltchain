#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/lichen-helper-guards.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

assert_rejected() {
    local label="$1"
    local expected="$2"
    shift 2

    local output_file="$TMP_DIR/${label//[^a-zA-Z0-9]/_}.log"
    if env -u LICHEN_LOCAL_DEV "$@" >"$output_file" 2>&1; then
        echo "❌ ${label}: command unexpectedly succeeded"
        cat "$output_file"
        exit 1
    fi

    if ! grep -Fq "$expected" "$output_file"; then
        echo "❌ ${label}: expected output missing"
        echo "Expected: $expected"
        echo "Actual output:"
        cat "$output_file"
        exit 1
    fi

    echo "✅ ${label}"
}

echo
echo "🔒 Local Helper Guard Tests"
echo "============================================================"

assert_rejected \
    "run-validator guard" \
    "run-validator.sh is restricted to explicit local development." \
    "$ROOT_DIR/run-validator.sh" testnet 1

assert_rejected \
    "run-custody guard" \
    "run-custody.sh is restricted to explicit local development." \
    "$ROOT_DIR/scripts/run-custody.sh" testnet

assert_rejected \
    "lichen-start custody guard" \
    "Error: --custody is restricted to explicit local development." \
    "$ROOT_DIR/lichen-start.sh" testnet --custody

echo "============================================================"
echo "Local helper guards: 3 passed, 0 failed"