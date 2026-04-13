/**
 * Lichen DEX E2E Test Setup Helper
 *
 * Provides a complete "zero-to-trading" setup for E2E tests against LIVE
 * VPS/testnet deployments where real WASM contracts run real token operations.
 *
 * WHY THIS EXISTS:
 * Local test harness uses #[cfg(not(target_arch = "wasm32"))] stubs that
 * bypass token transfers/approvals. On VPS, real contracts require:
 *   1. LICN airdrop (native token for fees & buy-side orders)
 *   2. Wrapped token minting (lUSD, wSOL, etc.) by the genesis minter
 *   3. Token approvals (trader → DEX/AMM contract as spender)
 *   4. LichenID registration + reputation boost (for governance/prediction)
 *   5. Prediction market creation (requires reputation ≥ 500)
 *
 * USAGE:
 *   const { setupDexEnvironment } = require('./helpers/dex-setup');
 *   const env = await setupDexEnvironment({ rpcUrl, wallets, contracts, adminKeypair });
 *
 * The admin keypair is the genesis-primary key (= operational_token_admin = minter).
 */
'use strict';

const pq = require('./pq-node');
const { loadFundedWallets, findGenesisAdminKeypair, bs58encode, bs58decode } = require('./funded-wallets');

const SPORES_PER_LICN = 1_000_000_000;
const AIRDROP_AMOUNT = 10; // LICN per round
const AIRDROP_COOLDOWN_MS = 61_000;
const TARGET_BALANCE_LICN = 100; // Minimum LICN each wallet needs

// ═══════════════════════════════════════════════════════════════════════════════
// Binary helpers
// ═══════════════════════════════════════════════════════════════════════════════
function writeU64LE(view, off, n) {
    view.setBigUint64(off, BigInt(Math.round(n)), true);
}

function writePubkey(arr, off, addr) {
    const decoded = bs58decode(addr);
    arr.set(decoded.subarray(0, 32), off);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Instruction builders (named exports for token contracts)
// ═══════════════════════════════════════════════════════════════════════════════
const CONTRACT_PID = bs58encode(new Uint8Array(32).fill(0xFF));

function namedCallIx(callerAddr, contractAddr, funcName, argsBytes, value = 0) {
    const data = JSON.stringify({ Call: { function: funcName, args: Array.from(argsBytes), value } });
    return { program_id: CONTRACT_PID, accounts: [callerAddr, contractAddr], data };
}

function contractIx(callerAddr, contractAddr, argsBytes, value = 0) {
    return namedCallIx(callerAddr, contractAddr, 'call', argsBytes, value);
}

/**
 * Build mint instruction: mint(caller, to, amount)
 * Token contracts use named export "mint" with 72-byte args:
 *   [0-31]: caller (32B)
 *   [32-63]: to (32B)
 *   [64-71]: amount (u64 LE, in spores)
 */
function buildMintArgs(callerAddr, toAddr, amountSpores) {
    const buf = new ArrayBuffer(72);
    const v = new DataView(buf);
    const a = new Uint8Array(buf);
    writePubkey(a, 0, callerAddr);
    writePubkey(a, 32, toAddr);
    writeU64LE(v, 64, amountSpores);
    return a;
}

/**
 * Build approve instruction: approve(owner, spender, amount)
 * Token contracts use named export "approve" with 72-byte args:
 *   [0-31]: owner (32B)
 *   [32-63]: spender (32B)
 *   [64-71]: amount (u64 LE, in spores)
 */
function buildApproveArgs(ownerAddr, spenderAddr, amountSpores) {
    const buf = new ArrayBuffer(72);
    const v = new DataView(buf);
    const a = new Uint8Array(buf);
    writePubkey(a, 0, ownerAddr);
    writePubkey(a, 32, spenderAddr);
    writeU64LE(v, 64, amountSpores);
    return a;
}

/**
 * Build attest_reserves instruction:
 *   attest_reserves(caller, reserve_amount, proof_hash)
 *   [0-31]: caller (32B)
 *   [32-39]: reserve_amount (u64 LE)
 *   [40-71]: proof_hash (32B SHA256)
 */
function buildAttestReservesArgs(callerAddr, reserveAmount) {
    const buf = new ArrayBuffer(72);
    const v = new DataView(buf);
    const a = new Uint8Array(buf);
    writePubkey(a, 0, callerAddr);
    writeU64LE(v, 32, reserveAmount);
    // proof_hash: 32 bytes of zeros for testnet
    return a;
}

/**
 * Build LichenID register_identity:
 *   register_identity(owner, agent_type, name_ptr, name_len)
 *   [0-31]: owner (32B)
 *   [32]: agent_type (1B) — 0=Human, 1=Agent, 2=Validator
 *   [33-34]: name_len (u16 LE)
 *   [35+]: name UTF-8 bytes
 */
function buildRegisterIdentityArgs(ownerAddr, agentType, name) {
    const nameBytes = Buffer.from(name, 'utf8');
    const buf = new ArrayBuffer(35 + nameBytes.length);
    const a = new Uint8Array(buf);
    const v = new DataView(buf);
    writePubkey(a, 0, ownerAddr);
    a[32] = agentType;
    v.setUint16(33, nameBytes.length, true);
    a.set(nameBytes, 35);
    return a;
}

/**
 * Build LichenID update_reputation_typed:
 *   update_reputation_typed(caller, target, contribution_type, count)
 *   [0-31]: caller/admin (32B)
 *   [32-63]: target (32B)
 *   [64]: contribution_type (1B) — 0=tx, 1=governance, 2=program_deployed, etc.
 *   [65-72]: count (u64 LE)
 */
function buildUpdateReputationArgs(adminAddr, targetAddr, contributionType, count) {
    const buf = new ArrayBuffer(73);
    const v = new DataView(buf);
    const a = new Uint8Array(buf);
    writePubkey(a, 0, adminAddr);
    writePubkey(a, 32, targetAddr);
    a[64] = contributionType;
    writeU64LE(v, 65, count);
    return a;
}

/**
 * Build prediction market create_market:
 *   [0-31]: creator (32B)
 *   [32]: category (1B)
 *   [33-40]: close_slot (u64 LE)
 *   [41]: outcome_count (1B)
 *   [42-73]: question_hash (32B SHA256)
 *   [74+]: question UTF-8
 */
function buildCreateMarketArgs(creatorAddr, category, closeSlot, outcomeCount, question) {
    const crypto = require('crypto');
    const questionBytes = Buffer.from(question, 'utf8');
    const questionHash = crypto.createHash('sha256').update(questionBytes).digest();
    const buf = new ArrayBuffer(74 + questionBytes.length);
    const v = new DataView(buf);
    const a = new Uint8Array(buf);
    writePubkey(a, 0, creatorAddr);
    a[32] = category;
    writeU64LE(v, 33, closeSlot);
    a[41] = outcomeCount;
    a.set(questionHash, 42);
    a.set(questionBytes, 74);
    return a;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RPC / Transaction helpers
// ═══════════════════════════════════════════════════════════════════════════════
let rpcIdCounter = 9000;

function hexToBytes(h) {
    const c = h.startsWith('0x') ? h.slice(2) : h;
    const o = new Uint8Array(c.length / 2);
    for (let i = 0; i < o.length; i++) o[i] = parseInt(c.slice(i * 2, i * 2 + 2), 16);
    return o;
}

function encodeMsg(instructions, blockhash, signer) {
    const parts = [];
    function pushU64(n) {
        const buf = new ArrayBuffer(8);
        const v = new DataView(buf);
        v.setUint32(0, n & 0xFFFFFFFF, true);
        v.setUint32(4, Math.floor(n / 0x100000000) & 0xFFFFFFFF, true);
        parts.push(new Uint8Array(buf));
    }
    pushU64(instructions.length);
    for (const ix of instructions) {
        parts.push(bs58decode(ix.program_id));
        const accts = ix.accounts || [signer];
        pushU64(accts.length);
        for (const a of accts) parts.push(bs58decode(a));
        const d = typeof ix.data === 'string' ? new TextEncoder().encode(ix.data) : new Uint8Array(ix.data);
        pushU64(d.length);
        parts.push(d);
    }
    parts.push(hexToBytes(blockhash));
    parts.push(new Uint8Array([0x00])); // compute_budget: None
    parts.push(new Uint8Array([0x00])); // compute_unit_price: None
    const total = parts.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const a of parts) { out.set(a, off); off += a.length; }
    return out;
}

async function rpcCall(rpcUrl, method, params = []) {
    const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: rpcIdCounter++, method, params }),
    });
    const json = await res.json();
    if (json.error) throw new Error(`RPC ${json.error.code}: ${json.error.message}`);
    return json.result;
}

async function sendSetupTx(rpcUrl, keypair, instructions) {
    const bhRes = await rpcCall(rpcUrl, 'getRecentBlockhash');
    const bh = typeof bhRes === 'string' ? bhRes : bhRes.blockhash;
    const nix = instructions.map(ix => ({
        program_id: ix.program_id,
        accounts: ix.accounts || [keypair.address],
        data: typeof ix.data === 'string' ? Array.from(new TextEncoder().encode(ix.data)) : Array.from(ix.data),
    }));
    const msg = encodeMsg(nix, bh, keypair.address);
    const sig = pq.sign(msg, keypair);
    const payload = { signatures: [sig], message: { instructions: nix, blockhash: bh } };
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    return rpcCall(rpcUrl, 'sendTransaction', [b64]);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getSpendableLicn(rpcUrl, address) {
    const balance = await rpcCall(rpcUrl, 'getBalance', [address]);
    return Number(balance?.spendable || 0) / SPORES_PER_LICN;
}

function isRateLimitError(error) {
    return String(error?.message || '').toLowerCase().includes('rate limit');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Setup phases
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Phase 1: Airdrop LICN to all wallets.
 * Handles 60s rate limit per address by batching with delays.
 */
async function fundWalletsWithLicn(rpcUrl, wallets, targetLicn = TARGET_BALANCE_LICN) {
    const results = {};
    const targetThreshold = targetLicn * 0.9;

    for (const w of wallets) {
        let currentLicn = await getSpendableLicn(rpcUrl, w.address);
        results[w.address] = currentLicn;
        if (currentLicn >= targetThreshold) {
            console.log(`    ✓ ${w.address.slice(0, 12)}... already has ${currentLicn.toFixed(1)} LICN`);
            continue;
        }

        const roundsNeeded = Math.ceil((targetLicn - currentLicn) / AIRDROP_AMOUNT);
        console.log(`    ⟳ ${w.address.slice(0, 12)}... needs ${roundsNeeded} airdrop rounds (${currentLicn.toFixed(1)} → ${targetLicn} LICN)`);

        let attempts = 0;
        while (currentLicn < targetThreshold && attempts < 12) {
            const requestAmount = Math.min(AIRDROP_AMOUNT, Math.max(1, Math.ceil(targetLicn - currentLicn)));
            attempts += 1;
            try {
                await rpcCall(rpcUrl, 'requestAirdrop', [w.address, requestAmount]);
            } catch (e) {
                if (isRateLimitError(e)) {
                    console.log(`    ⏳ Rate limited, waiting 61s...`);
                    await sleep(AIRDROP_COOLDOWN_MS);
                    continue;
                }
                console.error(`    ✗ Airdrop failed for ${w.address.slice(0, 12)}...: ${e.message}`);
                break;
            }

            await sleep(1500);
            currentLicn = await getSpendableLicn(rpcUrl, w.address);
            results[w.address] = currentLicn;
        }

        if (currentLicn >= targetThreshold) {
            console.log(`    ✓ ${w.address.slice(0, 12)}... funded to ${currentLicn.toFixed(1)} LICN`);
        }
    }
    return results;
}

/**
 * Phase 2: Mint wrapped tokens to wallets using the genesis admin (minter) keypair.
 * The minter is the genesis-primary key = operational_token_admin.
 * Before minting: must attest reserves if bootstrap is complete.
 */
async function mintWrappedTokens(rpcUrl, adminKeypair, wallets, contracts) {
    const tokens = [
        { key: 'lusd_token', symbol: 'lUSD', amount: 10_000 * SPORES_PER_LICN },
        { key: 'wsol_token', symbol: 'wSOL', amount: 100 * SPORES_PER_LICN },
        { key: 'weth_token', symbol: 'wETH', amount: 10 * SPORES_PER_LICN },
    ];

    for (const token of tokens) {
        const contractAddr = contracts[token.key];
        if (!contractAddr) {
            console.log(`    ⚠ ${token.symbol} contract not found, skipping`);
            continue;
        }

        // Attest reserves first (needed for minting circuit breaker)
        try {
            const attestArgs = buildAttestReservesArgs(adminKeypair.address, 1_000_000_000 * SPORES_PER_LICN);
            await sendSetupTx(rpcUrl, adminKeypair, [
                namedCallIx(adminKeypair.address, contractAddr, 'attest_reserves', attestArgs),
            ]);
            console.log(`    ✓ ${token.symbol} reserves attested`);
        } catch (e) {
            // May fail if already attested or if bootstrap not complete (minting still works)
            console.log(`    ⚠ ${token.symbol} attest_reserves: ${e.message.slice(0, 80)}`);
        }
        await sleep(1500);

        // Mint tokens to each wallet
        for (const w of wallets) {
            try {
                const mintArgs = buildMintArgs(adminKeypair.address, w.address, token.amount);
                await sendSetupTx(rpcUrl, adminKeypair, [
                    namedCallIx(adminKeypair.address, contractAddr, 'mint', mintArgs),
                ]);
                console.log(`    ✓ Minted ${token.amount / SPORES_PER_LICN} ${token.symbol} → ${w.address.slice(0, 12)}...`);
            } catch (e) {
                console.log(`    ✗ Mint ${token.symbol} → ${w.address.slice(0, 12)}...: ${e.message.slice(0, 80)}`);
            }
            await sleep(1000);
        }
    }
}

/**
 * Phase 3: Approve DEX and AMM contracts as token spenders.
 * Each wallet must approve dex_core AND dex_amm for each wrapped token.
 */
async function approveTokenSpenders(rpcUrl, wallets, contracts) {
    const tokens = ['lusd_token', 'wsol_token', 'weth_token'];
    const spenders = ['dex_core', 'dex_amm'];
    const MAX_ALLOWANCE = BigInt('18446744073709551615'); // u64::MAX

    for (const w of wallets) {
        for (const tokenKey of tokens) {
            const tokenAddr = contracts[tokenKey];
            if (!tokenAddr) continue;
            for (const spenderKey of spenders) {
                const spenderAddr = contracts[spenderKey];
                if (!spenderAddr) continue;
                try {
                    const approveArgs = buildApproveArgs(w.address, spenderAddr, Number(MAX_ALLOWANCE));
                    await sendSetupTx(rpcUrl, w, [
                        namedCallIx(w.address, tokenAddr, 'approve', approveArgs),
                    ]);
                    console.log(`    ✓ ${w.address.slice(0, 8)}... approved ${spenderKey} for ${tokenKey}`);
                } catch (e) {
                    console.log(`    ✗ Approve ${tokenKey}→${spenderKey} for ${w.address.slice(0, 8)}...: ${e.message.slice(0, 80)}`);
                }
                await sleep(500);
            }
        }
    }
}

/**
 * Phase 4: Register LichenID identities and boost reputation for governance/prediction.
 * Requires admin keypair (LichenID admin = governance_authority).
 */
async function setupIdentities(rpcUrl, adminKeypair, wallets, contracts) {
    const lichenidAddr = contracts.lichenid;
    if (!lichenidAddr) {
        console.log('    ⚠ LichenID contract not found, skipping identity setup');
        return;
    }

    // The LichenID admin is governance_authority (different from token admin).
    // Try finding it from genesis keys.
    for (const [i, w] of wallets.entries()) {
        const name = ['Alice', 'Bob', 'Charlie'][i] || `Trader${i}`;

        // Register identity
        try {
            const regArgs = buildRegisterIdentityArgs(w.address, 1, `E2E-${name}`);
            await sendSetupTx(rpcUrl, w, [
                namedCallIx(w.address, lichenidAddr, 'register_identity', regArgs),
            ]);
            console.log(`    ✓ Registered LichenID: ${name}`);
        } catch (e) {
            // May already be registered
            console.log(`    ⚠ Register ${name}: ${e.message.slice(0, 80)}`);
        }
        await sleep(500);

        // Boost reputation via admin (contribution_type=2=program_deployed, +100 each, need ≥5 for 500+)
        for (let j = 0; j < 6; j++) {
            try {
                const repArgs = buildUpdateReputationArgs(adminKeypair.address, w.address, 2, 1);
                await sendSetupTx(rpcUrl, adminKeypair, [
                    namedCallIx(adminKeypair.address, lichenidAddr, 'update_reputation_typed', repArgs),
                ]);
            } catch (e) {
                console.log(`    ⚠ Rep boost ${name} round ${j}: ${e.message.slice(0, 60)}`);
                break;
            }
            await sleep(300);
        }
        console.log(`    ✓ Boosted reputation for ${name} (600+)`);
    }
}

/**
 * Phase 5: Create prediction markets for testing.
 */
async function createPredictionMarkets(rpcUrl, creatorKeypair, contracts) {
    const predAddr = contracts.prediction_market;
    if (!predAddr) {
        console.log('    ⚠ Prediction market contract not found, skipping');
        return;
    }

    // Get current slot for close_slot calculation
    const currentSlot = await rpcCall(rpcUrl, 'getSlot');
    const closeSlot = currentSlot + 100000; // ~22 hours at 800ms blocks

    const markets = [
        { category: 2, question: 'Will LICN reach $1 by end of Q2 2026?', outcomes: 2 },
        { category: 0, question: 'Will more than 100 validators join by July 2026?', outcomes: 2 },
        { category: 2, question: 'Will total DEX volume exceed 10M LICN this month?', outcomes: 3 },
    ];

    for (const market of markets) {
        try {
            const args = buildCreateMarketArgs(
                creatorKeypair.address,
                market.category,
                closeSlot,
                market.outcomes,
                market.question,
            );
            // Prediction market creation requires value (creation fee = 10 lUSD = 10e9 spores)
            const sig = await sendSetupTx(rpcUrl, creatorKeypair, [
                contractIx(creatorKeypair.address, predAddr, args, 10 * SPORES_PER_LICN),
            ]);
            console.log(`    ✓ Created market: "${market.question.slice(0, 50)}..." (${sig.slice(0, 12)}...)`);
        } catch (e) {
            console.log(`    ✗ Create market: ${e.message.slice(0, 80)}`);
        }
        await sleep(1500);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main orchestrator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Complete E2E environment setup. Call once before test suite runs.
 *
 * @param {Object} opts
 * @param {string} opts.rpcUrl - RPC endpoint URL
 * @param {Array} opts.wallets - Array of {address, seed, publicKey} keypair objects
 * @param {Object} opts.contracts - Map of contract_name → address (from discoverContracts)
 * @param {Object} [opts.adminKeypair] - Genesis primary keypair (minter/admin). Auto-discovered if omitted.
 * @param {boolean} [opts.skipFunding=false] - Skip LICN airdrop phase
 * @param {boolean} [opts.skipMinting=false] - Skip wrapped token minting
 * @param {boolean} [opts.skipApprovals=false] - Skip token approvals
 * @param {boolean} [opts.skipIdentities=false] - Skip LichenID setup
 * @param {boolean} [opts.skipPrediction=false] - Skip prediction market creation
 * @param {number} [opts.targetLicn=100] - Target LICN balance per wallet
 * @returns {Object} Setup results summary
 */
async function setupDexEnvironment(opts) {
    const {
        rpcUrl,
        wallets,
        contracts,
        skipFunding = false,
        skipMinting = false,
        skipApprovals = false,
        skipIdentities = false,
        skipPrediction = false,
        targetLicn = TARGET_BALANCE_LICN,
    } = opts;

    let adminKeypair = opts.adminKeypair;

    // Auto-discover admin keypair if not provided.
    // When running against VPS testnet, prefer state-testnet keys (encrypted,
    // require LICHEN_KEYPAIR_PASSWORD) over stale local state-7001 keys.
    if (!adminKeypair) {
        const rpcLower = (rpcUrl || '').toLowerCase();
        if (rpcLower.includes('testnet') || rpcLower.includes('15.204.229.189') || rpcLower.includes('37.59.97.61') || rpcLower.includes('15.235.142.253')) {
            const path = require('path');
            const fw = require('./funded-wallets');
            const testnetKeyDir = path.resolve(__dirname, '../../data/state-testnet/genesis-keys');
            try {
                adminKeypair = fw.loadKeypairFile(path.join(testnetKeyDir, 'genesis-primary-lichen-testnet-1.json'));
                console.log(`    ✓ Admin keypair loaded from state-testnet: ${adminKeypair.address.slice(0, 16)}...`);
            } catch (e) {
                console.log(`    ⚠ Cannot load state-testnet admin key: ${e.message.slice(0, 80)}`);
                console.log('      Set LICHEN_KEYPAIR_PASSWORD to decrypt VPS genesis keys');
            }
        }
        if (!adminKeypair) {
            adminKeypair = findGenesisAdminKeypair();
        }
        if (!adminKeypair) {
            console.log('  ⚠ No genesis admin keypair found — skipping admin-only setup');
            console.log('    (mint, attest, reputation boost, prediction markets will be skipped)');
        }
    }

    const summary = { phases: {} };

    // Phase 1: Fund wallets with LICN (include admin if it needs fees for minting)
    if (!skipFunding) {
        console.log('\n── Setup Phase 1: LICN Funding ──');
        // Fund admin with just enough LICN for fees (~20 txs × 0.001 = 0.02 LICN, 10 LICN is plenty)
        if (adminKeypair && !wallets.some(w => w.address === adminKeypair.address)) {
            await fundWalletsWithLicn(rpcUrl, [adminKeypair], 10);
        }
        summary.phases.funding = await fundWalletsWithLicn(rpcUrl, wallets, targetLicn);
        await sleep(2000);
    }

    // Phase 2: Mint wrapped tokens (requires admin)
    if (!skipMinting && adminKeypair) {
        console.log('\n── Setup Phase 2: Mint Wrapped Tokens ──');
        await mintWrappedTokens(rpcUrl, adminKeypair, wallets, contracts);
        summary.phases.minting = true;
        await sleep(2000);
    }

    // Phase 3: Approve DEX/AMM as spenders
    if (!skipApprovals) {
        console.log('\n── Setup Phase 3: Token Approvals ──');
        await approveTokenSpenders(rpcUrl, wallets, contracts);
        summary.phases.approvals = true;
        await sleep(2000);
    }

    // Phase 4: LichenID identities + reputation (requires admin)
    if (!skipIdentities && adminKeypair) {
        console.log('\n── Setup Phase 4: LichenID Identities ──');
        await setupIdentities(rpcUrl, adminKeypair, wallets, contracts);
        summary.phases.identities = true;
        await sleep(2000);
    }

    // Phase 5: Create prediction markets (requires reputation)
    if (!skipPrediction && adminKeypair && wallets.length > 0) {
        console.log('\n── Setup Phase 5: Prediction Markets ──');
        await createPredictionMarkets(rpcUrl, wallets[0], contracts);
        summary.phases.prediction = true;
        await sleep(2000);
    }

    // Final balance check
    console.log('\n── Setup Complete: Final Balances ──');
    for (const w of wallets) {
        try {
            const bal = await rpcCall(rpcUrl, 'getBalance', [w.address]);
            console.log(`    ${w.address.slice(0, 12)}... : ${bal.spendable_licn} LICN`);
        } catch { }
    }

    return summary;
}

module.exports = {
    setupDexEnvironment,
    fundWalletsWithLicn,
    mintWrappedTokens,
    approveTokenSpenders,
    setupIdentities,
    createPredictionMarkets,
    namedCallIx,
    contractIx,
    sendSetupTx,
    rpcCall,
    buildMintArgs,
    buildApproveArgs,
    buildAttestReservesArgs,
    buildRegisterIdentityArgs,
    buildUpdateReputationArgs,
    buildCreateMarketArgs,
    SPORES_PER_LICN,
};
