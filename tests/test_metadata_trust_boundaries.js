// Frontend metadata trust-boundary checks
// Run: node tests/test_metadata_trust_boundaries.js

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
const sharedUtilsSource = fs.readFileSync(path.join(root, 'monitoring', 'shared', 'utils.js'), 'utf8');
const dexSource = fs.readFileSync(path.join(root, 'dex', 'dex.js'), 'utf8');
const marketConfigSource = fs.readFileSync(path.join(root, 'marketplace', 'js', 'marketplace-config.js'), 'utf8');
const marketDataSource = fs.readFileSync(path.join(root, 'marketplace', 'js', 'marketplace-data.js'), 'utf8');
const marketCreateSource = fs.readFileSync(path.join(root, 'marketplace', 'js', 'create.js'), 'utf8');
const marketItemSource = fs.readFileSync(path.join(root, 'marketplace', 'js', 'item.js'), 'utf8');
const marketProfileSource = fs.readFileSync(path.join(root, 'marketplace', 'js', 'profile.js'), 'utf8');
const explorerSource = fs.readFileSync(path.join(root, 'explorer', 'js', 'explorer.js'), 'utf8');
const explorerAddressSource = fs.readFileSync(path.join(root, 'explorer', 'js', 'address.js'), 'utf8');
const explorerContractSource = fs.readFileSync(path.join(root, 'explorer', 'js', 'contract.js'), 'utf8');
const explorerContractsSource = fs.readFileSync(path.join(root, 'explorer', 'js', 'contracts.js'), 'utf8');
const monitoringSource = fs.readFileSync(path.join(root, 'monitoring', 'js', 'monitoring.js'), 'utf8');
const playgroundSource = fs.readFileSync(path.join(root, 'programs', 'js', 'playground-complete.js'), 'utf8');

console.log('\n── Shared Trusted RPC Helpers ──');

assert(sharedUtilsSource.includes('function getTrustedLichenRpcUrl('), 'META-1 shared utils expose trusted RPC URL helper');
assert(sharedUtilsSource.includes('async function trustedLichenRpcCall('), 'META-2 shared utils expose trusted RPC call helper');
assert(sharedUtilsSource.includes('getTrustedLichenRpcUrl, lichenRpcCall, trustedLichenRpcCall, rpcCall'), 'META-3 shared utils export trusted RPC helpers to Node/browser consumers');
assert(sharedUtilsSource.includes('var LICHEN_SIGNED_METADATA_SIGNERS = Object.freeze('), 'META-3a shared utils define trusted metadata signing roots');
assert(sharedUtilsSource.includes('async function getSignedMetadataManifest('), 'META-3b shared utils expose signed metadata manifest loader');
assert(sharedUtilsSource.includes('async function signedMetadataRpcCall('), 'META-3c shared utils expose signed metadata RPC interception helper');
assert(sharedUtilsSource.includes("trustedLichenRpcCall('getSignedMetadataManifest', [], normalizedNetwork || undefined)"), 'META-3d signed metadata is fetched through trusted transport before verification');

console.log('\n── DEX Trusted Registry Reads ──');

assert(dexSource.includes('function getTrustedMetadataNetworkKey()'), 'META-4 DEX defines trusted metadata network resolver');
assert(dexSource.includes('async function trustedMetadataRpcCall('), 'META-5 DEX defines trusted metadata RPC helper');
assert(dexSource.includes("trustedMetadataRpcCall('getAllSymbolRegistry', [100])"), 'META-6 DEX pins symbol registry reads to trusted metadata RPC');
assert(dexSource.includes('signedMetadataRpcCall(method, params, getTrustedMetadataNetworkKey()'), 'META-6a DEX routes registry RPC methods through the signed metadata helper');

console.log('\n── Marketplace Trusted Registry Reads ──');

assert(marketConfigSource.includes('window.marketTrustedRpcCall = function'), 'META-7 marketplace config exposes trusted metadata RPC helper');
assert(marketConfigSource.includes('signedMetadataRpcCall(method, params, window.getTrustedMarketNetwork()'), 'META-7a marketplace routes registry RPC methods through the signed metadata helper');
assert(marketDataSource.includes("marketTrustedRpcCall('getContractInfo'"), 'META-8 marketplace data pins collection name contract-info reads');
assert(marketDataSource.includes("marketTrustedRpcCall('getAllContracts'"), 'META-9 marketplace data pins contract inventory reads');
assert(marketDataSource.includes("marketTrustedRpcCall('getSymbolRegistry', ['LICHENMARKET'])"), 'META-10 marketplace data pins marketplace program lookup');
assert(marketCreateSource.includes("marketTrustedRpcCall('getSymbolRegistry', ['LICHENMARKET'])"), 'META-11 marketplace create page pins marketplace program lookup');
assert(marketCreateSource.includes("marketTrustedRpcCall('getSymbolRegistry', ['MOSS'])"), 'META-12 marketplace create page pins Moss storage lookup');
assert(marketItemSource.includes("marketTrustedRpcCall('getSymbolRegistry', ['LICHENMARKET'])"), 'META-13 marketplace item page pins marketplace program lookup');
assert(marketProfileSource.includes("marketTrustedRpcCall('getSymbolRegistry', ['LICHENMARKET'])"), 'META-14 marketplace profile page pins marketplace program lookup');

console.log('\n── Explorer Trusted Registry Reads ──');

assert(explorerSource.includes('async function trustedRpcCall('), 'META-15 explorer defines trusted RPC helper');
assert(explorerSource.includes('signedMetadataRpcCall(method, params, getTrustedExplorerNetwork()'), 'META-15c explorer routes registry RPC methods through the signed metadata helper');
assert(explorerSource.includes("trustedRpcCall('getContractInfo', [value])"), 'META-15a explorer search pins contract-info routing checks');
assert(explorerSource.includes("trustedRpcCall('getSymbolRegistry', [value.toUpperCase()])"), 'META-15b explorer search pins symbol routing checks');
assert(explorerAddressSource.includes("trustedRpcCall('getSymbolRegistry'"), 'META-16 explorer address page pins LichenID symbol lookup');
assert(explorerAddressSource.includes("trustedRpcCall('getSymbolRegistryByProgram'"), 'META-17 explorer address page pins registry-by-program lookup');
assert(explorerContractSource.includes("trustedRpcCall('getContractInfo'"), 'META-18 explorer contract page pins contract-info lookup');
assert(explorerContractSource.includes("trustedRpcCall('getSymbolRegistryByProgram'"), 'META-19 explorer contract page pins registry-by-program lookup');
assert(explorerContractsSource.includes("trustedRpcCall('getAllContracts'"), 'META-20 explorer contracts page pins contract inventory lookup');
assert(explorerContractsSource.includes("trustedRpcCall('getAllSymbolRegistry'"), 'META-21 explorer contracts page pins symbol registry inventory lookup');
assert(explorerContractsSource.includes("trustedRpcCall('getContractInfo'"), 'META-22 explorer contracts page pins per-contract metadata lookup');

console.log('\n── Monitoring Trusted Registry Reads ──');

assert(monitoringSource.includes('async function trustedMonitoringRpc('), 'META-23 monitoring defines trusted registry RPC helper');
assert(monitoringSource.includes('signedMetadataRpcCall(method, params, getTrustedMonitoringNetwork()'), 'META-23a monitoring routes registry RPC methods through the signed metadata helper');
assert(monitoringSource.includes("trustedMonitoringRpc('getSymbolRegistry'"), 'META-24 monitoring pins contract label registry reads');

console.log('\n── Programs Trusted Registry Reads ──');

assert(playgroundSource.includes('async trustedMetadataRpc(method, params = [])'), 'META-25 programs defines trusted metadata RPC helper');
assert(playgroundSource.includes('signedMetadataRpcCall(method, params, this.network'), 'META-25a programs routes registry RPC methods through the signed metadata helper');
assert(playgroundSource.includes("this.trustedMetadataRpc('getSymbolRegistry', [symbol])"), 'META-26 programs pins symbol availability checks');
assert(playgroundSource.includes("this.trustedMetadataRpc('getSymbolRegistry', [registryPayload.symbol])"), 'META-27 programs pins deploy-time registry collision checks');
assert(playgroundSource.includes("this.trustedMetadataRpc('getSymbolRegistryByProgram', [resolvedProgramId])"), 'META-28 programs pins registry-by-program info lookups');

console.log(`\n${'═'.repeat(50)}`);
console.log(`Metadata Trust Boundaries: ${passed} passed, ${failed} failed (${passed + failed} total)`);
console.log(`${'═'.repeat(50)}`);
process.exit(failed > 0 ? 1 : 0);