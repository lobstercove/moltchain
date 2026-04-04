// Marketplace wallet hardening checks
// Run: node tests/test_marketplace_wallet_hardening.js

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
const walletSource = fs.readFileSync(path.join(root, 'marketplace', 'shared', 'wallet-connect.js'), 'utf8');
const browseSource = fs.readFileSync(path.join(root, 'marketplace', 'js', 'browse.js'), 'utf8');
const createSource = fs.readFileSync(path.join(root, 'marketplace', 'js', 'create.js'), 'utf8');
const itemSource = fs.readFileSync(path.join(root, 'marketplace', 'js', 'item.js'), 'utf8');
const profileSource = fs.readFileSync(path.join(root, 'marketplace', 'js', 'profile.js'), 'utf8');

console.log('\n── Marketplace Wallet Hardening ──');

assert(walletSource.includes('extensionOnlyWalletError'), 'MKT-1 extension-only error helper exists');
assert(walletSource.includes('Browser-local wallets are disabled in Marketplace.'), 'MKT-2 extension-only error message documents wallet boundary');
assert(!walletSource.includes('Lichen.Wallet.import('), 'MKT-3 local wallet import removed');
assert(!walletSource.includes('Lichen.Wallet.create('), 'MKT-4 local wallet creation removed');
assert(!walletSource.includes("lichenRpcCall('createWallet'"), 'MKT-5 RPC wallet creation fallback removed');
assert(!walletSource.includes('window.LichenPQ'), 'MKT-6 PQ wallet generation fallback removed');
assert(!walletSource.includes('_sdkWallet'), 'MKT-7 SDK wallet state removed');
assert(walletSource.includes('provider.sendTransaction'), 'MKT-8 delegated extension signing path retained');
assert(walletSource.includes("data.provider !== 'extension'"), 'MKT-9 restore path rejects non-extension wallet state');
assert(walletSource.includes('LichenWallet.prototype._openWalletModal'), 'MKT-10 connect prompt hook exists for gated actions');
assert(walletSource.includes('self.toggle().catch('), 'MKT-11 connect button path swallows failed extension connect errors');

assert(browseSource.includes('window.lichenWallet._openWalletModal()'), 'MKT-12 browse page uses connect prompt for gated actions');
assert(createSource.includes('window.lichenWallet._openWalletModal()'), 'MKT-13 create page uses connect prompt for gated actions');
assert(itemSource.includes('window.lichenWallet._openWalletModal()'), 'MKT-14 item page uses connect prompt for gated actions');
assert(profileSource.includes('window.lichenWallet.sendTransaction(['), 'MKT-15 profile actions still route through shared wallet signer');

console.log(`\n${'═'.repeat(50)}`);
console.log(`Marketplace Wallet Hardening: ${passed} passed, ${failed} failed (${passed + failed} total)`);
console.log(`${'═'.repeat(50)}`);
process.exit(failed > 0 ? 1 : 0);