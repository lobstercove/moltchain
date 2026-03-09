#!/usr/bin/env python3
"""
TEST-11 — Developer Lifecycle End-to-End Test
==============================================

Exercises the complete developer onboarding journey in one coherent flow:

  1. Generate a fresh keypair
  2. Fund it via faucet airdrop
  3. Verify balance
  4. Deploy a WASM contract (moltcoin template)
  5. Read contract info
  6. Call a contract function (name / symbol / total_supply)
  7. Perform a signed transfer to a second keypair
  8. Verify recipient balance

Requires a running validator + faucet:
    RPC_URL   (default http://127.0.0.1:8899)
    FAUCET_URL (default http://127.0.0.1:9100)

Run:  python3 tests/e2e-developer-lifecycle.py
"""

import asyncio
import base64
import hashlib
import json
import os
import sys
import time
from pathlib import Path

# ── Locate SDK ──
REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "sdk" / "python"))

from moltchain import Connection, Keypair, PublicKey, TransactionBuilder, Instruction

# ── Config ──
RPC_URL    = os.environ.get("RPC_URL",    "http://127.0.0.1:8899")
FAUCET_URL = os.environ.get("FAUCET_URL", "http://127.0.0.1:9100")
WASM_PATH  = REPO / "contracts" / "moltcoin" / "moltcoin.wasm"

CONTRACT_PROGRAM = PublicKey(b"\xff" * 32)

passed = 0
failed = 0

def ok(msg):
    global passed
    passed += 1
    print(f"  \u2713 {msg}")

def fail(msg, detail=""):
    global failed
    failed += 1
    extra = f": {detail}" if detail else ""
    print(f"  \u2717 {msg}{extra}", file=sys.stderr)

# ═══════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════

async def faucet_airdrop(address: str, amount: int = 100) -> dict:
    """Request shells from the faucet REST API."""
    import urllib.request
    data = json.dumps({"address": address, "amount": amount}).encode()
    req = urllib.request.Request(
        f"{FAUCET_URL}/faucet/request",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    resp = urllib.request.urlopen(req, timeout=10)
    return json.loads(resp.read())


async def wait_for_balance(conn: Connection, pubkey: PublicKey, min_shells: int,
                           timeout: float = 30.0) -> dict:
    """Poll until account has at least min_shells spendable balance."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            bal = await conn.get_balance(pubkey)
            spendable = bal.get("spendable", bal.get("shells", 0))
            if spendable >= min_shells:
                return bal
        except Exception:
            pass
        await asyncio.sleep(0.5)
    raise TimeoutError(f"Balance did not reach {min_shells} within {timeout}s")


async def deploy_contract(conn: Connection, deployer: Keypair, wasm_bytes: bytes,
                          init_data: str | None = None) -> tuple[PublicKey, dict]:
    """Deploy a WASM contract, return (program_pubkey, rpc_result)."""
    code_hash = hashlib.sha256(wasm_bytes).digest()
    sig = deployer.sign(code_hash)

    # Derive deterministic program address
    h = hashlib.sha256(deployer.public_key().to_bytes() + wasm_bytes).digest()
    program_pubkey = PublicKey(h[:32])

    result = await conn._rpc("deployContract", [
        deployer.public_key().to_base58(),
        base64.b64encode(wasm_bytes).decode("ascii"),
        init_data,
        sig.hex(),
    ])
    return program_pubkey, result


async def call_contract_rpc(conn: Connection, contract: PublicKey,
                            func: str, args: str = "") -> dict:
    """Read-only contract call via callContract RPC."""
    result = await conn._rpc("callContract", {
        "contract": contract.to_base58(),
        "function": func,
        "args": base64.b64encode(args.encode()).decode() if args else "",
    })
    return result


async def call_contract_tx(conn: Connection, caller: Keypair,
                           contract: PublicKey, func: str,
                           args: dict | None = None) -> str:
    """Write contract call via signed transaction, return signature."""
    args_bytes = json.dumps(args or {}).encode()
    payload = json.dumps({
        "Call": {"function": func, "args": list(args_bytes), "value": 0}
    })
    ix = Instruction(
        program_id=CONTRACT_PROGRAM,
        accounts=[caller.public_key(), contract],
        data=payload.encode(),
    )
    blockhash = await conn.get_recent_blockhash()
    tx = (TransactionBuilder()
          .add(ix)
          .set_recent_blockhash(blockhash)
          .build_and_sign(caller))
    return await conn.send_transaction(tx)


# ═══════════════════════════════════════════════════════════════════════════
# Main lifecycle
# ═══════════════════════════════════════════════════════════════════════════

async def main():
    print(f"\n{'═' * 60}")
    print(f"  TEST-11: Developer Lifecycle E2E")
    print(f"  RPC: {RPC_URL}  |  Faucet: {FAUCET_URL}")
    print(f"{'═' * 60}\n")

    conn = Connection(RPC_URL)

    # ── Phase 1: Health check ──
    print("── Phase 1: Cluster health ──")
    try:
        health = await conn.health()
        assert health is not None
        ok("Cluster is healthy")
    except Exception as e:
        fail("Cluster health check", str(e))
        print("\n  Cannot proceed — validator not reachable.\n")
        return

    # ── Phase 2: Generate fresh keypair ──
    print("\n── Phase 2: Generate keypair ──")
    dev = Keypair.generate()
    dev_addr = dev.public_key().to_base58()
    assert len(dev_addr) >= 32
    ok(f"Generated keypair: {dev_addr[:12]}...")

    recipient = Keypair.generate()
    rec_addr = recipient.public_key().to_base58()
    ok(f"Generated recipient: {rec_addr[:12]}...")

    # ── Phase 3: Fund via faucet ──
    print("\n── Phase 3: Fund via faucet ──")
    try:
        airdrop = await faucet_airdrop(dev_addr, 100)
        assert airdrop.get("success") is True or "signature" in airdrop
        ok(f"Faucet airdrop succeeded (sig: {str(airdrop.get('signature',''))[:16]}...)")
    except Exception as e:
        fail("Faucet airdrop request", str(e))
        # Try continuing — genesis wallets may already be funded
        print("  (continuing with existing balance)")

    # ── Phase 4: Verify balance ──
    print("\n── Phase 4: Verify balance ──")
    try:
        bal = await wait_for_balance(conn, dev.public_key(), 1_000_000, timeout=20)
        shells = bal.get("spendable", bal.get("shells", 0))
        ok(f"Balance confirmed: {shells:,} shells ({shells / 1_000_000_000:.4f} MOLT)")
    except TimeoutError:
        fail("Balance did not arrive within 20s")
        # Fall back to a genesis-funded deployer
        deployer_path = REPO / "keypairs" / "deployer.json"
        if deployer_path.exists():
            dev = Keypair.load(deployer_path)
            dev_addr = dev.public_key().to_base58()
            print(f"  Falling back to deployer keypair: {dev_addr[:12]}...")
            try:
                bal = await conn.get_balance(dev.public_key())
                shells = bal.get("spendable", bal.get("shells", 0))
                ok(f"Deployer balance: {shells:,} shells")
            except Exception as e2:
                fail("Could not read deployer balance", str(e2))

    # ── Phase 5: Deploy contract ──
    print("\n── Phase 5: Deploy contract ──")
    if not WASM_PATH.exists():
        fail(f"WASM file not found: {WASM_PATH}")
        program_pubkey = None
    else:
        wasm_bytes = WASM_PATH.read_bytes()
        ok(f"Loaded WASM: {len(wasm_bytes):,} bytes")

        init_data = json.dumps({
            "symbol": "DEVTEST",
            "name": "DevLifecycleToken",
            "template": "mt20",
        })

        try:
            program_pubkey, deploy_result = await deploy_contract(
                conn, dev, wasm_bytes, init_data
            )
            ok(f"Contract deployed: {program_pubkey.to_base58()[:16]}...")
            if isinstance(deploy_result, dict):
                pid = deploy_result.get("program_id", "")
                ok(f"RPC returned program_id: {str(pid)[:16]}...")
        except Exception as e:
            fail("deployContract RPC", str(e))
            program_pubkey = None

    # ── Phase 6: Read contract info ──
    print("\n── Phase 6: Read contract info ──")
    if program_pubkey:
        try:
            info = await conn.get_contract_info(program_pubkey)
            assert info is not None
            ok(f"get_contract_info: deployer={str(info.get('deployer',''))[:16]}...")
        except Exception as e:
            fail("get_contract_info", str(e))

        # Read-only calls: name, symbol, total_supply
        for fn_name in ["name", "symbol", "total_supply"]:
            try:
                result = await call_contract_rpc(conn, program_pubkey, fn_name)
                ok(f"callContract('{fn_name}'): {str(result)[:40]}")
            except Exception as e:
                fail(f"callContract('{fn_name}')", str(e))
    else:
        fail("Skipping — no deployed contract")

    # ── Phase 7: Signed transfer ──
    print("\n── Phase 7: Signed transfer ──")
    transfer_amount = 500_000_000  # 0.5 MOLT
    try:
        blockhash = await conn.get_recent_blockhash()
        ix = TransactionBuilder.transfer(
            dev.public_key(), recipient.public_key(), transfer_amount
        )
        tx = (TransactionBuilder()
              .add(ix)
              .set_recent_blockhash(blockhash)
              .build_and_sign(dev))
        sig = await conn.send_transaction(tx)
        ok(f"Transfer sent: {str(sig)[:16]}... ({transfer_amount / 1e9:.2f} MOLT)")
    except Exception as e:
        fail("send_transaction (transfer)", str(e))

    # ── Phase 8: Verify recipient balance ──
    print("\n── Phase 8: Verify recipient balance ──")
    try:
        rec_bal = await wait_for_balance(
            conn, recipient.public_key(), transfer_amount // 2, timeout=15
        )
        rec_shells = rec_bal.get("spendable", rec_bal.get("shells", 0))
        ok(f"Recipient balance: {rec_shells:,} shells")
        if rec_shells >= transfer_amount:
            ok("Full transfer amount confirmed")
        else:
            fail(f"Expected >= {transfer_amount}, got {rec_shells}")
    except TimeoutError:
        fail("Recipient balance did not arrive within 15s")

    # ── Summary ──
    global passed, failed
    total = passed + failed
    print(f"\n{'═' * 60}")
    print(f"  Developer Lifecycle E2E: {passed} passed, {failed} failed, {total} total")
    print(f"{'═' * 60}\n")

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
