#!/usr/bin/env python3
import argparse
import json
import time
import urllib.request
from collections import Counter


def rpc(url: str, method: str, params=None):
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params or []}).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as response:
        return json.loads(response.read().decode())["result"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rpc", default="http://127.0.0.1:8899")
    parser.add_argument("--slots", type=int, default=120)
    parser.add_argument("--label", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--timeout-seconds", type=int, default=900)
    args = parser.parse_args()

    latest = rpc(args.rpc, "getLatestBlock")
    start_slot = int(latest["slot"])
    seen = set()
    blocks = []
    started = time.time()

    while len(seen) < args.slots and (time.time() - started) < args.timeout_seconds:
        current = rpc(args.rpc, "getLatestBlock")
        slot = int(current["slot"])
        if slot > start_slot and slot not in seen:
            seen.add(slot)
            blocks.append(
                {
                    "slot": slot,
                    "validator": current.get("validator"),
                    "transaction_count": int(current.get("transaction_count", 0)),
                    "timestamp": current.get("timestamp"),
                }
            )
        time.sleep(0.2)

    completed = time.time()
    all_counts = Counter(b["validator"] or "unknown" for b in blocks)
    tx_counts = Counter(b["validator"] or "unknown" for b in blocks if b["transaction_count"] > 0)
    heartbeat_counts = Counter(b["validator"] or "unknown" for b in blocks if b["transaction_count"] == 0)

    result = {
        "label": args.label,
        "rpc": args.rpc,
        "target_slots": args.slots,
        "captured_slots": len(blocks),
        "start_slot": start_slot + 1,
        "end_slot": max(seen) if seen else start_slot,
        "duration_seconds": round(completed - started, 2),
        "counts_all": dict(all_counts),
        "counts_tx_blocks": dict(tx_counts),
        "counts_heartbeat_blocks": dict(heartbeat_counts),
        "blocks": blocks,
    }

    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(result, handle, indent=2)

    print(f"wrote {args.out}")
    print(json.dumps({
        "label": args.label,
        "captured_slots": result["captured_slots"],
        "duration_seconds": result["duration_seconds"],
        "counts_all": result["counts_all"],
        "counts_tx_blocks": result["counts_tx_blocks"],
        "counts_heartbeat_blocks": result["counts_heartbeat_blocks"],
    }, indent=2))


if __name__ == "__main__":
    main()
