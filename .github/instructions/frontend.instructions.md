---
description: "Use when editing JavaScript/HTML/CSS frontend files for wallet, explorer, DEX, marketplace, developer portal, programs IDE, monitoring, faucet, or website."
applyTo: ["wallet/**/*.js", "explorer/**/*.js", "dex/**/*.js", "marketplace/**/*.js", "developers/**/*.js", "programs/**/*.js", "monitoring/**/*.js", "faucet/**/*.js", "website/**/*.js"]
---
# Frontend Development Guidelines

## Environment Detection
All portals use `shared-config.js` for auto-detecting dev vs production:
```javascript
const config = MOLT_CONFIG;
const rpcUrl = config.rpc();  // auto: localhost:8899 or rpc.moltchain.network
const wsUrl = config.ws();    // auto: localhost:8900 or ws.moltchain.network
```
NEVER hardcode `localhost` or production URLs.

## Shared Utilities
Canonical source: `monitoring/shared/`
- `shared/utils.js` — RPC helpers, formatting, pubkey encoding
- `shared/wallet-connect.js` — Wallet connection, transaction signing

Sync with: `make sync-shared`

## RPC Calls
```javascript
const result = await fetch(MOLT_CONFIG.rpc(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'methodName', params: [...] })
}).then(r => r.json());
```

## CSS
- Use `shared-base-styles.css` for layout primitives
- Use `shared-theme.css` for colors and typography
- Follow existing BEM-like naming in each portal

## Deployment
All frontends deploy to Cloudflare Pages via:
```bash
npx wrangler pages deploy <dir> --project-name moltchain-<portal>
```
