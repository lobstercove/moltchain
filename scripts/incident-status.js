#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const INCIDENT_GUARDIAN_PAUSE_TARGETS = Object.freeze(
    require(path.join(__dirname, '..', 'shared', 'incident-guardian-pause-allowlist.json')),
);

const DEFAULT_STATUS_FILES = Object.freeze({
    mainnet: '/etc/lichen/incident-status-mainnet.json',
    testnet: '/etc/lichen/incident-status-testnet.json',
    'local-mainnet': '/etc/lichen/incident-status-mainnet.json',
    'local-testnet': '/etc/lichen/incident-status-testnet.json',
});

const DEFAULT_COMPONENTS = Object.freeze({
    bridge: Object.freeze({
        status: 'operational',
        message: 'Bridge deposits and mints are operating normally.',
    }),
    contracts: Object.freeze({
        status: 'operational',
        message: 'No contract circuit breakers are active.',
    }),
    deposits: Object.freeze({
        status: 'operational',
        message: 'Deposits and withdrawals are operating normally.',
    }),
    wallet: Object.freeze({
        status: 'operational',
        message: 'Local wallet access remains available.',
    }),
});

function usage() {
    return [
        'Usage: node scripts/incident-status.js <preset> [options]',
        '',
        'Presets:',
        '  normal',
        '  deposit-guard',
        '  bridge-pause',
        '  contract-circuit-breaker',
        '',
        'Options:',
        '  --network <network>          Network label written into the manifest (default: mainnet)',
        '  --file <path>                Manifest file path (default: env or /etc/lichen/incident-status-<network>.json)',
        '  --status-page-url <url>      Optional public status URL',
        '  --contract <name>            Known guardian-allowlist target for contract-circuit-breaker',
        '  --active-since <timestamp>   Override active_since ISO-8601 timestamp',
        '  --updated-at <timestamp>     Override updated_at ISO-8601 timestamp',
        '  --dry-run                    Print manifest to stdout without writing it',
        '  --print                      Print manifest after writing it',
        '  --help, -h                   Show this help output',
    ].join('\n');
}

function cloneComponents(overrides = {}) {
    return {
        bridge: { ...DEFAULT_COMPONENTS.bridge, ...(overrides.bridge || {}) },
        contracts: { ...DEFAULT_COMPONENTS.contracts, ...(overrides.contracts || {}) },
        deposits: { ...DEFAULT_COMPONENTS.deposits, ...(overrides.deposits || {}) },
        wallet: { ...DEFAULT_COMPONENTS.wallet, ...(overrides.wallet || {}) },
    };
}

function resolveStatusFile(network, explicitFile) {
    if (explicitFile) {
        return explicitFile;
    }
    if (process.env.LICHEN_INCIDENT_STATUS_FILE) {
        return process.env.LICHEN_INCIDENT_STATUS_FILE;
    }
    return DEFAULT_STATUS_FILES[network] || `/etc/lichen/incident-status-${network}.json`;
}

function normalizeTimestamp(value, fallback) {
    const text = String(value || '').trim();
    return text || fallback;
}

function normalizeMatchKey(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function contractCircuitBreakerTargets() {
    return INCIDENT_GUARDIAN_PAUSE_TARGETS.filter((target) => target.preset_enabled !== false);
}

function supportedContractCircuitBreakerTargets() {
    return contractCircuitBreakerTargets()
        .map((target) => target.id)
        .sort();
}

function resolveContractCircuitBreakerTarget(contract) {
    const requested = normalizeMatchKey(contract);
    if (!requested) {
        throw new Error(
            `contract-circuit-breaker requires --contract with one of: ${supportedContractCircuitBreakerTargets().join(', ')}`,
        );
    }

    const match = contractCircuitBreakerTargets().find((target) => {
        const keys = [
            target.id,
            target.symbol,
            `${target.symbol}.${target.pause_function}`,
            target.display_name,
            ...(target.aliases || []),
        ];
        return keys.some((key) => normalizeMatchKey(key) === requested);
    });

    if (!match) {
        throw new Error(
            `Unknown contract-circuit-breaker target '${contract}'. Known targets: ${supportedContractCircuitBreakerTargets().join(', ')}`,
        );
    }

    return match;
}

function buildContractCircuitBreakerEnforcement(target) {
    return {
        mode: 'incident_guardian_allowlisted_pause',
        contract_targets: [
            {
                id: target.id,
                symbol: target.symbol,
                display_name: target.display_name,
                pause_function: target.pause_function,
            },
        ],
    };
}

function buildIncidentStatusPreset(preset, options = {}) {
    const network = String(options.network || 'mainnet').trim() || 'mainnet';
    const updatedAt = normalizeTimestamp(options.updatedAt, new Date().toISOString());
    const activeSince = normalizeTimestamp(options.activeSince, updatedAt);
    const statusPageUrl = Object.prototype.hasOwnProperty.call(options, 'statusPageUrl')
        ? options.statusPageUrl || null
        : null;

    switch (preset) {
        case 'normal':
            return {
                schema_version: 1,
                source: 'operator',
                network,
                updated_at: updatedAt,
                active_since: null,
                mode: 'normal',
                severity: 'info',
                banner_enabled: false,
                headline: 'All systems operational',
                summary: 'No incident response mode is active.',
                customer_message: 'Deposits, bridge access, and wallet usage are operating normally.',
                status_page_url: statusPageUrl,
                actions: [],
                components: cloneComponents(),
            };
        case 'deposit-guard':
            return {
                schema_version: 1,
                source: 'operator',
                network,
                updated_at: updatedAt,
                active_since: activeSince,
                mode: 'deposit_guard',
                severity: 'high',
                banner_enabled: true,
                headline: 'Deposits temporarily paused',
                summary: 'Lichen has entered a deposit-only protection mode while operators verify abnormal inbound flow.',
                customer_message: 'Do not initiate new deposits until another update is published. Wallet access and existing on-chain positions remain available.',
                status_page_url: statusPageUrl,
                actions: [
                    'Delay new deposits until operators publish a clear-all update.',
                    'Use existing wallet balances normally unless another component is marked otherwise.',
                ],
                components: cloneComponents({
                    deposits: {
                        status: 'paused',
                        message: 'New deposits are paused while operators verify inbound activity.',
                    },
                }),
            };
        case 'bridge-pause':
            return {
                schema_version: 1,
                source: 'operator',
                network,
                updated_at: updatedAt,
                active_since: activeSince,
                mode: 'bridge_pause',
                severity: 'high',
                banner_enabled: true,
                headline: 'Bridge transfers temporarily paused',
                summary: 'Operators paused bridge deposits and mints while investigating bridge-specific risk.',
                customer_message: 'Do not start new bridge transfers until the bridge component returns to operational status. Local wallet access and non-bridge on-chain usage remain available.',
                status_page_url: statusPageUrl,
                actions: [
                    'Avoid new bridge deposits or redemptions until the pause is lifted.',
                    'Use local wallet balances normally unless another component shows degraded status.',
                ],
                components: cloneComponents({
                    bridge: {
                        status: 'paused',
                        message: 'Bridge deposits and mints are paused while bridge risk is assessed.',
                    },
                }),
            };
        case 'contract-circuit-breaker': {
            const target = resolveContractCircuitBreakerTarget(options.contract);
            return {
                schema_version: 1,
                source: 'operator',
                network,
                updated_at: updatedAt,
                active_since: activeSince,
                mode: 'contract_circuit_breaker',
                severity: 'warning',
                banner_enabled: true,
                headline: `${target.display_name} is in circuit-breaker mode`,
                summary: `${target.display_name} is temporarily restricted while operators verify abnormal behavior.`,
                customer_message: `Only the affected contract flow is restricted. Wallet access, balances, and unrelated protocol components remain available unless they are explicitly flagged below.`,
                status_page_url: statusPageUrl,
                actions: [
                    `Avoid ${target.display_name} activity until operators publish the recovery update.`,
                    'Check the component badges below before taking protocol-admin or treasury actions.',
                ],
                enforcement: buildContractCircuitBreakerEnforcement(target),
                components: cloneComponents({
                    contracts: {
                        status: 'degraded',
                        message: target.component_message,
                    },
                }),
            };
        }
        default:
            throw new Error(`Unknown preset: ${preset}`);
    }
}

function parseCliArgs(argv) {
    const args = [...argv];
    const result = {
        help: false,
        preset: null,
        options: {},
    };

    while (args.length > 0) {
        const token = args.shift();
        if (token === '--help' || token === '-h') {
            result.help = true;
            continue;
        }
        if (!result.preset && !token.startsWith('--')) {
            result.preset = token;
            continue;
        }

        const value = () => {
            if (args.length === 0) {
                throw new Error(`Missing value for ${token}`);
            }
            return args.shift();
        };

        switch (token) {
            case '--network':
                result.options.network = value();
                break;
            case '--file':
                result.options.file = value();
                break;
            case '--status-page-url':
                result.options.statusPageUrl = value();
                break;
            case '--contract':
                result.options.contract = value();
                break;
            case '--active-since':
                result.options.activeSince = value();
                break;
            case '--updated-at':
                result.options.updatedAt = value();
                break;
            case '--dry-run':
                result.options.dryRun = true;
                break;
            case '--print':
                result.options.print = true;
                break;
            default:
                throw new Error(`Unknown argument: ${token}`);
        }
    }

    return result;
}

function readExistingManifest(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

function applyExistingDefaults(status, existing) {
    if (!existing || typeof existing !== 'object') {
        return status;
    }

    if (status.status_page_url === null && typeof existing.status_page_url === 'string') {
        status.status_page_url = existing.status_page_url;
    }

    return status;
}

function writeManifest(filePath, manifest) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function runCli(argv = process.argv.slice(2), io = { stdout: process.stdout, stderr: process.stderr }) {
    let parsed;
    try {
        parsed = parseCliArgs(argv);
    } catch (error) {
        io.stderr.write(`${error.message}\n\n${usage()}\n`);
        return 1;
    }

    if (parsed.help || !parsed.preset) {
        io.stdout.write(`${usage()}\n`);
        return parsed.help ? 0 : 1;
    }

    let manifest;
    try {
        const filePath = resolveStatusFile(parsed.options.network || 'mainnet', parsed.options.file);
        manifest = buildIncidentStatusPreset(parsed.preset, parsed.options);
        manifest = applyExistingDefaults(manifest, readExistingManifest(filePath));

        if (parsed.options.dryRun) {
            io.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
            return 0;
        }

        writeManifest(filePath, manifest);
        io.stdout.write(`Updated incident status manifest: ${filePath}\n`);
        if (parsed.options.print) {
            io.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
        }
        return 0;
    } catch (error) {
        io.stderr.write(`${error.message}\n`);
        return 1;
    }
}

if (require.main === module) {
    process.exit(runCli());
}

module.exports = {
    buildIncidentStatusPreset,
    parseCliArgs,
    resolveContractCircuitBreakerTarget,
    resolveStatusFile,
    runCli,
    supportedContractCircuitBreakerTargets,
    usage,
    writeManifest,
};