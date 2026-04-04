// Wallet modal parity checks across DEX, Marketplace, Programs
// Run: node tests/test_wallet_modal_parity.js

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, label) {
    if (condition) {
        passed++;
        console.log(`  ✅ ${label}`);
    } else {
        failed++;
        console.log(`  ❌ ${label}`);
    }
}

function normalizeHtml(html) {
    return html.replace(/\s+/g, ' ').trim();
}

function extractBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    if (start === -1 || end === -1 || end <= start) return null;
    return source.slice(start, end).trim();
}

const root = path.join(__dirname, '..');
const dexHtml = fs.readFileSync(path.join(root, 'dex', 'index.html'), 'utf8');
const programsHtml = fs.readFileSync(path.join(root, 'programs', 'playground.html'), 'utf8');
const programsJs = fs.readFileSync(path.join(root, 'programs', 'js', 'playground-complete.js'), 'utf8');
const programsSdk = fs.readFileSync(path.join(root, 'programs', 'js', 'lichen-sdk.js'), 'utf8');
const marketplaceWalletJs = fs.readFileSync(path.join(root, 'marketplace', 'shared', 'wallet-connect.js'), 'utf8');
const dexSharedWalletJs = fs.readFileSync(path.join(root, 'dex', 'shared', 'wallet-connect.js'), 'utf8');
const programsSharedWalletJs = fs.readFileSync(path.join(root, 'programs', 'shared', 'wallet-connect.js'), 'utf8');

console.log('\n── Wallet Modal Markup Parity ──');

const dexModal = extractBetween(
    dexHtml,
    '<div class="wallet-modal-overlay hidden" id="walletModal">',
    '<!-- ═══════════════════ FOOTER ═══════════════════ -->'
);
const programsModal = extractBetween(
    programsHtml,
    '<div class="wallet-modal-overlay hidden" id="walletModal">',
    '<!-- Import Program Modal -->'
);

assert(Boolean(dexModal), 'P-1 DEX wallet modal block found');
assert(Boolean(programsModal), 'P-2 Programs wallet modal block found');
if (dexModal && programsModal) {
    assert(
        normalizeHtml(dexModal) === normalizeHtml(programsModal),
        'P-3 Programs wallet modal markup matches DEX exactly'
    );
}

assert(!dexHtml.includes('data-wm-tab="import"'), 'P-4 DEX import tab removed');
assert(!dexHtml.includes('data-wm-tab="create"'), 'P-5 DEX create tab removed');
assert(!programsHtml.includes('data-wm-tab="import"'), 'P-6 Programs import tab removed');
assert(!programsHtml.includes('data-wm-tab="create"'), 'P-7 Programs create tab removed');

console.log('\n── Programs Wallet Behavior Parity ──');

assert(
    programsJs.includes("document.getElementById('walletBtn')?.addEventListener('click', () => {\n            this.openWalletModal();\n        });"),
    'P-8 walletBtn always opens wallet modal'
);
assert(
    !programsJs.includes('this.toggleWalletDropdown();'),
    'P-9 walletBtn no longer routes to wallet dropdown'
);
assert(
    programsJs.includes("this.switchWmTab(this.wallets.length ? 'wallets' : 'extension');"),
    'P-10 openWalletModal default tab matches DEX (extension if none)'
);
assert(
    programsJs.includes('this.resetWalletModalInputs();') &&
    programsJs.includes('closeWalletModal()'),
    'P-11 closeWalletModal resets modal inputs'
);
assert(
    programsJs.includes('Programs only supports extension-backed wallets.'),
    'P-12 Programs modal reset documents extension-only behavior'
);
assert(
    programsJs.includes('wmEmptyExtension') && programsJs.includes("this.switchWmTab('extension')"),
    'P-13 Programs empty wallet state routes to extension tab'
);
assert(
    programsJs.includes("throw new Error('Programs only supports extension-backed wallets');"),
    'P-14 Programs store rejects non-extension wallets'
);
assert(
    programsSdk.includes('Browser-local wallets are disabled in Programs. Use the Lichen wallet extension.'),
    'P-15 Programs SDK disables browser-local wallets'
);

console.log('\n── Marketplace Wallet Behavior Parity ──');

assert(
    marketplaceWalletJs.includes('function LichenWallet(options)') && marketplaceWalletJs.includes('LichenWallet.prototype.connect = async function'),
    'P-16 marketplace shared wallet utility still exposes the wallet manager interface'
);
assert(
    marketplaceWalletJs.includes('getInjectedLichenProvider') && marketplaceWalletJs.includes('waitForInjectedLichenProvider'),
    'P-17 marketplace shared wallet utility still supports injected provider discovery'
);
assert(
    marketplaceWalletJs.includes('normalizeRpcInstruction') && marketplaceWalletJs.includes('encodeTransactionPayload'),
    'P-18 marketplace shared wallet utility retains transaction normalization helpers'
);

console.log('\n── Shared Wallet Utility Parity ──');

assert(
    dexSharedWalletJs === programsSharedWalletJs,
    'P-19 programs shared wallet utility is byte-identical to DEX shared utility'
);
assert(
    dexSharedWalletJs.includes('extensionOnlyWalletError'),
    'P-20 shared wallet utility exposes extension-only error helper'
);
assert(
    !dexSharedWalletJs.includes('LichenPQ.generateKeypair') &&
    !dexSharedWalletJs.includes('createWallet') &&
    !dexSharedWalletJs.includes('window.Lichen && window.Lichen.Wallet'),
    'P-21 shared wallet utility no longer falls back to PQ, RPC, or local SDK wallets'
);

console.log(`\n${'═'.repeat(50)}`);
console.log(`Wallet Modal Parity Audit: ${passed} passed, ${failed} failed (${passed + failed} total)`);
console.log(`${'═'.repeat(50)}`);
process.exit(failed > 0 ? 1 : 0);
