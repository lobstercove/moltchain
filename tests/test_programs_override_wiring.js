// Programs Playground wallet/override hardening audit
// Run: node tests/test_programs_override_wiring.js

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

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'programs', 'playground.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'programs', 'js', 'playground-complete.js'), 'utf8');
const sdk = fs.readFileSync(path.join(root, 'programs', 'js', 'lichen-sdk.js'), 'utf8');

console.log('\n── Programs Wallet / Override Hardening ──');

assert(!html.includes('id="programSeedImportGroup"'), 'H-1 inline program-seed import container removed');
assert(!html.includes('id="programSeedImportInput"'), 'H-2 inline program-seed input removed');
assert(!html.includes('id="programSeedImportConfirmBtn"'), 'H-3 inline program-seed confirm removed');
assert(!html.includes('id="programSeedImportCancelBtn"'), 'H-4 inline program-seed cancel removed');
assert(!html.includes('id="newProgramKeypairBtn"'), 'H-5 program keypair generate button removed');
assert(!html.includes('id="importProgramKeypairBtn"'), 'H-6 program keypair import button removed');
assert(!html.includes('id="exportProgramKeypairBtn"'), 'H-7 program keypair export button removed');

assert(!html.includes('id="wmTabImport"'), 'H-8 wallet import tab removed from Programs');
assert(!html.includes('id="wmTabCreate"'), 'H-9 wallet create tab removed from Programs');

assert(!js.includes('toggleProgramSeedImportUI(show)'), 'H-10 program seed import helper removed');
assert(!js.includes('this.programKeypair'), 'H-11 program keypair state removed from playground');
assert(js.includes("localStorage.removeItem('program_keypair');"), 'H-12 legacy program keypair storage is purged');
assert(!js.includes("localStorage.setItem('program_keypair'"), 'H-13 program keypairs are no longer persisted');
assert(!js.includes("localStorage.setItem('lichen_wallet'"), 'H-14 browser wallet secrets are no longer persisted');
assert(!js.includes('await Lichen.Wallet.create('), 'H-15 playground no longer creates local wallets');
assert(!js.includes('await Lichen.Wallet.import('), 'H-16 playground no longer imports local wallets');
assert(js.includes("preview.value = 'Connect wallet to preview';"), 'H-17 Program ID preview has connect-wallet state');
assert(js.includes("preview.value = 'Build to preview';"), 'H-18 Program ID preview has build state when wallet connected');
assert(js.includes("preview.value = 'Enter override program id';"), 'H-19 override preview prompts for manual value');
assert(js.includes("this.wallet = this.buildExtensionWallet(active.address);"), 'H-20 active wallet restore is extension-backed only');

assert(sdk.includes('function localWalletsDisabledError()'), 'H-21 SDK exposes local-wallet disabled guard');
assert(!sdk.includes('function normalizeSeedInput(seed)'), 'H-22 SDK seed normalization helper removed');
assert(sdk.includes('Browser-local wallets are disabled in Programs. Use the Lichen wallet extension.'), 'H-23 SDK local wallet operations fail closed');
assert(!sdk.includes('seed: base58Encode(this.seed)'), 'H-24 SDK no longer exports browser wallet seeds');

console.log(`\n${'═'.repeat(50)}`);
console.log(`Programs Wallet / Override Hardening Audit: ${passed} passed, ${failed} failed (${passed + failed} total)`);
console.log(`${'═'.repeat(50)}`);
process.exit(failed > 0 ? 1 : 0);
