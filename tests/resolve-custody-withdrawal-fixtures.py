#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
RPC_URL = os.getenv("RPC_URL", "http://127.0.0.1:8899")
NETWORK = os.getenv("LICHEN_NETWORK", "testnet").lower()
TOKEN_ENV_NAME = "CUSTODY_API_AUTH_TOKEN"
PROCESS_PATTERN = os.getenv("CUSTODY_PROCESS_PATTERN", "lichen-custody")
PREFER_ENV_TOKEN = os.getenv("CUSTODY_DISCOVERY_PREFER_ENV", "0") == "1"
TOKEN_PATTERN = re.compile(r"(?:^|\s)CUSTODY_API_AUTH_TOKEN=([^\s]+)")


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return data if isinstance(data, dict) else {}


def keypair_pubkey(path: Path) -> str:
    try:
        payload = read_json(path)
    except Exception:
        return ""

    for key in ("pubkey", "address", "publicKeyBase58"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def rpc_call(method: str, params: list[Any]) -> Any:
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode(
        "utf-8"
    )
    request = Request(RPC_URL, data=body, headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=5) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if isinstance(payload, dict) and payload.get("error"):
        raise RuntimeError(str(payload["error"]))
    return payload.get("result") if isinstance(payload, dict) else None


def balance_spores(pubkey: str) -> int:
    if not pubkey:
        return 0
    try:
        result = rpc_call("getBalance", [pubkey])
    except Exception:
        return 0

    if isinstance(result, dict):
        value = result.get("spendable", result.get("spores", 0))
        try:
            return int(value)
        except Exception:
            return 0

    try:
        return int(result or 0)
    except Exception:
        return 0


def first_matching(path: Path, pattern: str) -> Path | None:
    matches = sorted(path.glob(pattern))
    return matches[0] if matches else None


def valid_genesis_dir(path: Path) -> bool:
    return path.is_dir() and first_matching(path, "genesis-primary-*.json") is not None and first_matching(
        path, "treasury-*.json"
    ) is not None


def candidate_genesis_dirs() -> list[tuple[Path, str]]:
    candidates: list[tuple[Path, str]] = []
    seen: set[str] = set()

    def append(path: Path | None, source: str) -> None:
        if path is None:
            return
        key = str(path)
        if key in seen:
            return
        seen.add(key)
        candidates.append((path, source))

    explicit_dir = os.getenv("GENESIS_KEYS_DIR")
    if explicit_dir:
        append(Path(explicit_dir), "env")

    data_dir = ROOT / "data"
    preferred_state = "7001" if NETWORK == "testnet" else "8001"
    append(data_dir / f"state-{preferred_state}" / "genesis-keys", f"data/state-{preferred_state}/genesis-keys")
    append(
        data_dir / f"state-{preferred_state}" / "blockchain.db" / "genesis-keys",
        f"data/state-{preferred_state}/blockchain.db/genesis-keys",
    )

    for path in sorted(data_dir.glob("state-*/genesis-keys")):
        append(path, f"{path.relative_to(ROOT)}")
    for path in sorted(data_dir.glob("state-*/blockchain.db/genesis-keys")):
        append(path, f"{path.relative_to(ROOT)}")

    append(ROOT / "artifacts" / NETWORK / "genesis-keys", f"artifacts/{NETWORK}/genesis-keys")
    return candidates


def resolve_genesis_dir() -> dict[str, Any]:
    fallback: dict[str, Any] | None = None

    for path, source in candidate_genesis_dirs():
        if not valid_genesis_dir(path):
            continue

        treasury_keypair = first_matching(path, "treasury-*.json")
        token_admin_keypair = first_matching(path, "genesis-primary-*.json")
        if treasury_keypair is None or token_admin_keypair is None:
            continue

        treasury_pubkey = keypair_pubkey(treasury_keypair)
        token_admin_pubkey = keypair_pubkey(token_admin_keypair)
        treasury_balance = balance_spores(treasury_pubkey)
        token_admin_balance = balance_spores(token_admin_pubkey)
        candidate = {
            "genesis_keys_dir": str(path),
            "genesis_keys_source": source,
            "treasury_keypair": str(treasury_keypair),
            "token_admin_keypair": str(token_admin_keypair),
            "treasury_balance_spores": treasury_balance,
            "token_admin_balance_spores": token_admin_balance,
        }

        if source == "env":
            return candidate

        if treasury_balance > 0:
            return candidate

        if fallback is None:
            fallback = candidate

    return fallback or {
        "genesis_keys_dir": "",
        "genesis_keys_source": "",
        "treasury_keypair": "",
        "token_admin_keypair": "",
        "treasury_balance_spores": 0,
        "token_admin_balance_spores": 0,
    }


def resolve_token_from_process() -> tuple[str, str]:
    try:
        result = subprocess.run(
            ["pgrep", "-f", PROCESS_PATTERN],
            check=False,
            capture_output=True,
            text=True,
        )
    except Exception:
        return "", ""

    pids = [line.strip() for line in result.stdout.splitlines() if line.strip().isdigit()]
    for pid in pids:
        for command in (
            ["ps", "eww", "-o", "command=", "-p", pid],
            ["ps", "eww", "-p", pid],
            ["ps", "e", "-o", "command=", "-p", pid],
        ):
            try:
                output = subprocess.run(
                    command,
                    check=False,
                    capture_output=True,
                    text=True,
                ).stdout
            except Exception:
                continue

            match = TOKEN_PATTERN.search(output)
            if match:
                return match.group(1), f"process:{pid}"

    return "", ""


def resolve_custody_token() -> tuple[str, str]:
    explicit_token = os.getenv(TOKEN_ENV_NAME, "").strip()
    if PREFER_ENV_TOKEN and explicit_token:
        return explicit_token, "env"

    process_token, process_source = resolve_token_from_process()
    if process_token:
        return process_token, process_source

    if explicit_token:
        return explicit_token, "env"

    return "", ""


def main() -> int:
    genesis = resolve_genesis_dir()
    token, token_source = resolve_custody_token()
    payload = {
        "rpc_url": RPC_URL,
        "network": NETWORK,
        **genesis,
        "custody_api_auth_token": token,
        "custody_api_auth_token_source": token_source,
        "can_run_withdrawal_e2e": bool(genesis.get("genesis_keys_dir") and token),
    }
    print(json.dumps(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())