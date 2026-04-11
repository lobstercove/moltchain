#!/usr/bin/env node
/**
 * Debug script: sends a single DEX contract call to the VPS and reports exact error.
 * Usage: node tests/debug-contract-call.js [rpc-url]
 */
const pq = require('./helpers/pq-node');
const { loadFundedWallets } = require('./helpers/funded-wallets');
const https = require('https');
const http = require('http');

const RPC_URL = process.argv[2] || process.env.RPC_URL || 'https://testnet-rpc.lichen.network';
console.log('RPC:', RPC_URL);

let rpcId = 1;
function rpc(method, params = []) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params });
        const url = new URL(RPC_URL);
        const mod = url.protocol === 'https:' ? https : http;
        const req = mod.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        }, res => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => {
                try {
                    const j = JSON.parse(d);
                    if (j.error) reject(new Error(JSON.stringify(j.error)));
                    else resolve(j.result);
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

const BS58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function bs58decode(str) {
    let num = 0n;
    for (const c of str) { const i = BS58.indexOf(c); if (i < 0) throw new Error(`Bad b58: ${c}`); num = num * 58n + BigInt(i); }
    const hex = num === 0n ? '' : num.toString(16); const padded = hex.length % 2 ? '0' + hex : hex;
    const bytes = []; for (let i = 0; i < padded.length; i += 2) bytes.push(parseInt(padded.slice(i, i + 2), 16));
    let lo = 0; for (let i = 0; i < str.length && str[i] === '1'; i++) lo++;
    const r = new Uint8Array(lo + bytes.length); r.set(bytes, lo); return r;
}
function bs58encode(bytes) {
    let lz = 0; for (let i = 0; i < bytes.length && bytes[i] === 0; i++) lz++;
    let num = 0n; for (const b of bytes) num = num * 256n + BigInt(b);
    let enc = ''; while (num > 0n) { enc = BS58[Number(num % 58n)] + enc; num /= 58n; }
    return '1'.repeat(lz) + enc;
}
function hexToBytes(h) {
    const c = h.startsWith('0x') ? h.slice(2) : h;
    const o = new Uint8Array(c.length / 2);
    for (let i = 0; i < o.length; i++) o[i] = parseInt(c.slice(i * 2, i * 2 + 2), 16);
    return o;
}

const CONTRACT_PID = bs58encode(new Uint8Array(32).fill(0xFF));

function encodeMsg(instructions, blockhash, signerAddr) {
    const parts = [];
    parts.push(new Uint8Array([instructions.length]));
    for (const ix of instructions) {
        const pidB = bs58decode(ix.program_id);
        parts.push(new Uint8Array([pidB.length])); parts.push(pidB);
        parts.push(new Uint8Array([ix.accounts.length]));
        for (const a of ix.accounts) { const ab = bs58decode(a); parts.push(new Uint8Array([ab.length])); parts.push(ab); }
        const dataB = typeof ix.data === 'string' ? new TextEncoder().encode(ix.data) : new Uint8Array(ix.data);
        const lenBuf = new ArrayBuffer(4); new DataView(lenBuf).setUint32(0, dataB.length, true);
        parts.push(new Uint8Array(lenBuf)); parts.push(dataB);
    }
    parts.push(hexToBytes(blockhash));
    parts.push(new Uint8Array([0x00])); // compute_budget: None
    parts.push(new Uint8Array([0x00])); // compute_unit_price: None
    const total = parts.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total); let off = 0;
    for (const a of parts) { out.set(a, off); off += a.length; }
    return out;
}

async function main() {
    await pq.init();

    // Use funded genesis wallets
    const funded = loadFundedWallets(1);
    const alice = funded[0] || pq.keygen();
    console.log('Wallet:', alice.address);

    // Check balance
    const bal = await rpc('getBalance', [alice.address]);
    console.log('Balance:', bal.spendable_licn, 'LICN (', bal.spendable, 'spores)');
    if (bal.spendable === 0) {
        console.log('Attempting airdrop...');
        try {
            const a = await rpc('requestAirdrop', [alice.address, 10]);
            console.log('Airdrop:', JSON.stringify(a).slice(0, 200));
            await new Promise(r => setTimeout(r, 3000));
            const bal2 = await rpc('getBalance', [alice.address]);
            console.log('Balance after airdrop:', bal2.spendable_licn);
            if (bal2.spendable === 0) { console.log('STILL NO BALANCE'); return; }
        } catch (e) {
            console.log('Airdrop failed:', e.message.slice(0, 200));
            console.log('Cannot test contract call without funds');
            return;
        }
    }

    // Get contract addresses
    const reg = await rpc('getAllSymbolRegistry', [100]);
    const dex = reg.entries.find(e => e.symbol === 'DEX');
    if (!dex) { console.log('DEX contract not found in registry!'); return; }
    console.log('DEX contract:', dex.program);

    // Build DEX place_order: opcode 2, 67 bytes
    const args = new Uint8Array(67);
    args[0] = 2; // opcode: place_order
    args.set(bs58decode(alice.address).subarray(0, 32), 1); // trader
    const dv = new DataView(args.buffer);
    dv.setBigUint64(33, 1n, true); // pairId = 1 (LICN/lUSD)
    args[41] = 1; // side = buy
    args[42] = 0; // type = limit
    dv.setBigUint64(43, BigInt(120000000), true); // price = 0.12
    dv.setBigUint64(51, BigInt(5000000000), true); // qty = 5 LICN

    const callData = JSON.stringify({ Call: { function: 'call', args: Array.from(args), value: 0 } });
    const ix = { program_id: CONTRACT_PID, accounts: [alice.address, dex.program], data: callData };

    const bhRes = await rpc('getRecentBlockhash');
    const blockhash = typeof bhRes === 'string' ? bhRes : bhRes.blockhash;
    console.log('Blockhash:', blockhash.slice(0, 16) + '...');

    const msg = encodeMsg([ix], blockhash, alice.address);
    const sig = pq.sign(msg, alice);
    const payload = { signatures: [sig], message: { instructions: [ix], blockhash } };
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');

    console.log('\nSending contract call to VPS...');
    try {
        const txSig = await rpc('sendTransaction', [b64]);
        console.log('TX SIGNATURE:', txSig);

        console.log('Waiting 4s for confirmation...');
        await new Promise(r => setTimeout(r, 4000));

        const info = await rpc('getTransaction', [txSig]);
        console.log('STATUS:', info.status);
        console.log('ERROR:', info.error);
        console.log('TYPE:', info.type);
        console.log('FEE:', info.fee_licn);
        console.log('COMPUTE:', info.compute_units);
    } catch (e) {
        console.log('\n*** SEND ERROR ***:', e.message);
    }
}

main().catch(e => console.error('FATAL:', e.message));
