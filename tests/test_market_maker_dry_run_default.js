'use strict';

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed += 1;
        process.stdout.write(`  ✓ ${message}\n`);
        return;
    }
    failed += 1;
    process.stderr.write(`  ✗ ${message}\n`);
}

const root = path.resolve(__dirname, '..');

console.log('\n── HI-09: market-maker dry-run defaults ──');

const compose = fs.readFileSync(path.join(root, 'infra', 'docker-compose.yml'), 'utf8');
assert(
    compose.includes('MM_DRY_RUN=${MM_DRY_RUN:-true}'),
    'docker compose defaults the market-maker to dry-run mode'
);

const config = fs.readFileSync(path.join(root, 'dex', 'market-maker', 'src', 'config.ts'), 'utf8');
assert(
    config.includes("const dryRunEnv = (process.env.MM_DRY_RUN || 'true').trim().toLowerCase();"),
    'market-maker runtime config defaults MM_DRY_RUN to true when unset'
);
assert(
    config.includes("dryRun: !['false', '0', 'off'].includes(dryRunEnv),"),
    'market-maker runtime requires an explicit false-like override before live trading'
);

console.log(`\nHI-09 default checks: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}