#!/usr/bin/env python3
import glob
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "sdk", "python"))

from lichen import Keypair  # type: ignore

RPC_URL = os.getenv("RPC_URL", "http://127.0.0.1:8899")
RPC_ENDPOINTS = [
    endpoint.strip()
    for endpoint in os.getenv("RPC_ENDPOINTS", f"{RPC_URL},http://127.0.0.1:8901,http://127.0.0.1:8903").split(",")
    if endpoint.strip()
]
MIN_SPORES = int(os.getenv("MIN_FUNDED_SPORES", "1000000000"))
EXPLICIT_AGENT_KEYPAIR = os.getenv("AGENT_KEYPAIR", "").strip()
EXPLICIT_HUMAN_KEYPAIR = os.getenv("HUMAN_KEYPAIR", "").strip()


def rpc(endpoint: str, method: str, params=None):
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params or []}).encode()
    req = urllib.request.Request(endpoint, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as resp:
        out = json.loads(resp.read())
    if "error" in out:
        raise RuntimeError(out["error"].get("message", "RPC error"))
    return out.get("result")


def get_balance_spores(pubkey: str) -> int:
    for endpoint in RPC_ENDPOINTS:
        try:
            bal = rpc(endpoint, "getBalance", [pubkey])
            return int((bal or {}).get("spendable", (bal or {}).get("spores", 0)))
        except Exception:
            continue
    return 0


def priority(path):
    name = os.path.basename(path)
    if name == "deployer.json":
        return 0
    if name.startswith("genesis-primary"):
        return 1
    if name.startswith("genesis-signer"):
        return 2
    if name.startswith("community_treasury"):
        return 3
    if name.startswith("builder_grants"):
        return 4
    if name.startswith("ecosystem_partnerships"):
        return 5
    if name.startswith("reserve_pool"):
        return 6
    if name.startswith("validator_rewards"):
        return 7
    if name.startswith("founding_symbionts"):
        return 8
    if name.startswith("treasury"):
        return 9
    return 9


def is_governed_candidate(path):
    name = os.path.basename(path)
    return any(
        name.startswith(prefix)
        for prefix in (
            "community_treasury",
            "builder_grants",
            "ecosystem_partnerships",
            "reserve_pool",
            "validator_rewards",
            "founding_symbionts",
            "treasury",
        )
    )


def extract_pubkey(raw, path):
    for key in ("pubkey", "address", "publicKeyBase58", "address_base58"):
        value = raw.get(key)
        if isinstance(value, str) and value:
            return value

    try:
        return Keypair.load(path).address().to_base58()
    except Exception:
        return ""


def main():
    genesis_pattern = os.path.join(ROOT, "data", "**", "genesis-keys", "*.json")
    genesis_db_pattern = os.path.join(ROOT, "data", "**", "blockchain.db", "genesis-keys", "*.json")
    artifacts_pattern = os.path.join(ROOT, "artifacts", "testnet", "genesis-keys", "*.json")
    keypairs_pattern = os.path.join(ROOT, "keypairs", "*.json")
    files = sorted(
        set(
            glob.glob(genesis_pattern, recursive=True)
            + glob.glob(genesis_db_pattern, recursive=True)
            + glob.glob(artifacts_pattern)
            + glob.glob(keypairs_pattern, recursive=True)
        ),
        key=lambda p: (priority(p), p),
    )
    candidates = []
    all_candidates = []
    seen = set()
    by_path = {}

    for path in files:
        try:
            raw = json.loads(open(path, "r", encoding="utf-8").read())
        except Exception:
            continue
        pubkey = extract_pubkey(raw, path)
        if not pubkey:
            continue
        if pubkey in seen:
            continue
        seen.add(pubkey)
        spores = get_balance_spores(pubkey)
        candidate = {"path": path, "pubkey": pubkey, "spores": spores}
        all_candidates.append(candidate)
        by_path[os.path.abspath(path)] = candidate
        if spores >= MIN_SPORES:
            candidates.append(candidate)

        candidates.sort(key=lambda c: (priority(c["path"]), -c["spores"], c["path"]))
        all_candidates.sort(key=lambda c: (priority(c["path"]), -c["spores"], c["path"]))

        explicit_agent = by_path.get(os.path.abspath(EXPLICIT_AGENT_KEYPAIR)) if EXPLICIT_AGENT_KEYPAIR else None
        explicit_human = by_path.get(os.path.abspath(EXPLICIT_HUMAN_KEYPAIR)) if EXPLICIT_HUMAN_KEYPAIR else None

        agent = explicit_agent
        if agent is None:
            for group in (
                [candidate for candidate in candidates if not is_governed_candidate(candidate["path"])],
                candidates,
                [candidate for candidate in all_candidates if not is_governed_candidate(candidate["path"])],
                all_candidates,
            ):
                if group:
                    agent = group[0]
                    break

    human = None
    if agent is not None:
        if explicit_human is not None and explicit_human["pubkey"] != agent["pubkey"]:
            human = explicit_human

        candidate_groups = [
            [
                candidate
                for candidate in candidates
                if candidate["pubkey"] != agent["pubkey"] and not is_governed_candidate(candidate["path"])
            ],
            [
                candidate
                for candidate in all_candidates
                if candidate["pubkey"] != agent["pubkey"] and not is_governed_candidate(candidate["path"])
            ],
            [candidate for candidate in candidates if candidate["pubkey"] != agent["pubkey"]],
            [candidate for candidate in all_candidates if candidate["pubkey"] != agent["pubkey"]],
        ]
        if human is None:
            for group in candidate_groups:
                if group:
                    human = group[0]
                    break
    if human is None:
        human = candidates[1] if len(candidates) > 1 else agent

    print(json.dumps({
        "rpc": RPC_URL,
        "rpc_endpoints": RPC_ENDPOINTS,
        "min_spores": MIN_SPORES,
        "count": len(candidates),
        "all_count": len(all_candidates),
        "agent": agent,
        "human": human,
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
