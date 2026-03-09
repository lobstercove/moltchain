---
description: "Deploy frontend portals to Cloudflare Pages. Handles building, verifying configurations, and deploying."
agent: "agent"
tools: [read, search, execute, todo]
argument-hint: "Portal name: website, explorer, wallet, dex, marketplace, programs, developers, monitoring, faucet, or 'all'"
---
Deploy MoltChain frontend portal(s) to Cloudflare Pages.

## Pre-flight checks:
1. Verify `shared-config.js` uses hostname-based auto-detection (no hardcoded localhost)
2. Verify no remaining hardcoded `localhost` or `127.0.0.1` in JS files
3. Verify `wallet-connect.js` uses `MOLT_CONFIG.rpc()` for RPC URL
4. Run `make sync-shared` to ensure shared utilities are current

## Deploy:
```bash
npx wrangler pages deploy <dir> --project-name moltchain-<portal>
```

Portal mapping:
- website → `website/`
- explorer → `explorer/`
- wallet → `wallet/`
- dex → `dex/`
- marketplace → `marketplace/`
- programs → `programs/`
- developers → `developers/`
- monitoring → `monitoring/`
- faucet → `faucet/`

## Post-deploy:
1. Verify the deployment URL works
2. Update `DEPLOYMENT_STATUS.md` task 4.7 if all portals deployed
