#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

const portals = [
    { name: 'website', excludedRoots: new Set() },
    { name: 'explorer', excludedRoots: new Set() },
    { name: 'wallet', excludedRoots: new Set(['extension']) },
    { name: 'dex', excludedRoots: new Set(['loadtest', 'market-maker', 'sdk']) },
    { name: 'marketplace', excludedRoots: new Set() },
    { name: 'programs', excludedRoots: new Set() },
    { name: 'developers', excludedRoots: new Set() },
    { name: 'monitoring', excludedRoots: new Set() },
    { name: 'faucet', excludedRoots: new Set(['src']) },
];

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

function toPosix(value) {
    return value.split(path.sep).join('/');
}

function stripQueryAndHash(ref) {
    return String(ref || '').split('#')[0].split('?')[0];
}

function isExternalRef(ref) {
    return /^(?:[a-z]+:)?\/\//i.test(ref)
        || ref.startsWith('data:')
        || ref.startsWith('blob:')
        || ref.startsWith('mailto:')
        || ref.startsWith('tel:')
        || ref.startsWith('javascript:');
}

function collectHtmlFiles(portal, currentDir, relativeDir, htmlFiles) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith('.')) {
            continue;
        }

        const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
        const topLevel = relativePath.split('/')[0];
        if (portal.excludedRoots.has(topLevel)) {
            continue;
        }

        const absolutePath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            collectHtmlFiles(portal, absolutePath, relativePath, htmlFiles);
            continue;
        }

        if (entry.isFile() && entry.name.endsWith('.html')) {
            htmlFiles.push(absolutePath);
        }
    }
}

function getPortalHtmlFiles(portal) {
    const portalRoot = path.join(repoRoot, portal.name);
    const htmlFiles = [];
    collectHtmlFiles(portal, portalRoot, '', htmlFiles);
    return htmlFiles.sort();
}

function extractScriptRefs(html) {
    return Array.from(html.matchAll(/<script\b[^>]*\bsrc=(['"])([^'"]+)\1[^>]*>/gi), (match) => ({
        tag: match[0],
        ref: match[2],
    }));
}

function extractLinkRefs(html) {
    const results = [];
    const linkTags = html.match(/<link\b[^>]*>/gi) || [];
    for (const tag of linkTags) {
        const hrefMatch = tag.match(/\bhref=(['"])([^'"]+)\1/i);
        if (!hrefMatch) {
            continue;
        }

        const relMatch = tag.match(/\brel=(['"])([^'"]+)\1/i);
        const relValue = (relMatch ? relMatch[2] : '').toLowerCase();
        const assetLikeRel = relValue.includes('stylesheet')
            || relValue.includes('icon')
            || relValue.includes('manifest')
            || relValue.includes('modulepreload')
            || relValue.includes('preload');

        if (!assetLikeRel) {
            continue;
        }

        results.push({
            tag,
            ref: hrefMatch[2],
        });
    }

    return results;
}

function resolvePortalAsset(portalRoot, pageDir, ref) {
    const cleanRef = stripQueryAndHash(ref);
    if (cleanRef.startsWith('/')) {
        return path.join(portalRoot, cleanRef.slice(1));
    }
    return path.resolve(pageDir, cleanRef);
}

function getPortalRelativeAssetPath(portalRoot, absolutePath) {
    const relative = path.relative(portalRoot, absolutePath);
    return toPosix(relative);
}

function analyzeAssetRefs(portal, pagePath, refs, kind) {
    const portalRoot = path.join(repoRoot, portal.name);
    const pageDir = path.dirname(pagePath);
    const relativePage = toPosix(path.relative(repoRoot, pagePath));
    const localRefs = refs.filter(({ ref }) => ref && !isExternalRef(ref));
    const seen = new Map();
    const duplicates = [];
    const invalidAssets = [];

    for (const { ref, tag } of localRefs) {
        const normalizedRef = toPosix(stripQueryAndHash(ref));
        if (seen.has(normalizedRef)) {
            duplicates.push(normalizedRef);
        } else {
            seen.set(normalizedRef, tag);
        }

        const resolved = resolvePortalAsset(portalRoot, pageDir, ref);
        const relativeAsset = getPortalRelativeAssetPath(portalRoot, resolved);
        const topLevel = relativeAsset.split('/')[0];
        const staysInsidePortal = relativeAsset !== '' && !relativeAsset.startsWith('..');
        const pointsToDeployableRoot = staysInsidePortal && !portal.excludedRoots.has(topLevel);

        if (!pointsToDeployableRoot || !fs.existsSync(resolved)) {
            invalidAssets.push(ref);
        }

        if (normalizedRef.endsWith('shared/pq.js')) {
            const isModuleScript = /\btype=(['"])module\1/i.test(tag);
            if (isModuleScript) {
                invalidAssets.push(`${ref} [browser-pq-module-load]`);
            }
        }

        if (normalizedRef.endsWith('.mjs')) {
            const isModuleScript = /\btype=(['"])module\1/i.test(tag);
            if (!isModuleScript) {
                invalidAssets.push(`${ref} [module-script-required]`);
            }
        }
    }

    assert(duplicates.length === 0, `${relativePage} has no duplicate local ${kind} references`);
    assert(invalidAssets.length === 0, `${relativePage} local ${kind} references resolve to deployable assets`);
}

console.log('\n── Frontend Asset Integrity ──');

for (const portal of portals) {
    const htmlFiles = getPortalHtmlFiles(portal);
    assert(htmlFiles.length > 0, `${portal.name} contributes deployed HTML pages to the asset scan`);

    for (const pagePath of htmlFiles) {
        const html = fs.readFileSync(pagePath, 'utf8');
        analyzeAssetRefs(portal, pagePath, extractScriptRefs(html), 'script');
        analyzeAssetRefs(portal, pagePath, extractLinkRefs(html), 'link');
    }
}

console.log(`\nFrontend asset integrity: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}