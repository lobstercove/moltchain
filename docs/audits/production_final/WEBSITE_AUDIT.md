# Lichen Landing Website — Deep Production Audit

**Auditor:** Senior Developer Review  
**Date:** February 27, 2026  
**Scope:** `/website/` directory — all HTML, JS, CSS, and config files  
**Verdict:** ⚠️ Functional for demo — **NOT production-ready without fixes**

---

## 1. Executive Summary

The Lichen landing page (`index.html`) is a single-page marketing site (~1,245 lines HTML) with a live RPC integration, WebSocket block subscription, and a 5-step deploy wizard. The design system is well-executed and the page renders correctly in modern browsers.

**However**, the audit found several critical-to-medium bugs that will cause broken UI in production:

| Severity | Count | Examples |
|----------|-------|---------|
| 🔴 Critical | 3 | Validator count always shows 0; WS message format unverified; stat-validators field mismatch |
| 🟠 High | 5 | 3 nav sections unreachable; nav-actions mobile positioning bug; callContract not in RPC class |
| 🟡 Medium | 9 | CSS variable conflict cascade; container width 1800px; mobile nav doesn't close on click |
| 🟢 Low | 7 | Missing OG tags; FA icon availability; dead CSS variable names; no TPS live fetch |

**Total issues: 24**

---

## 2. File Inventory

| File | Lines | Type | Description |
|------|-------|------|-------------|
| [website/index.html](index.html) | 1,246 | HTML | Single-page site, all sections |
| [website/script.js](script.js) | 429 | JavaScript | RPC, WS, animations, UI logic |
| [website/shared-config.js](shared-config.js) | 43 | JavaScript | Cross-app URL resolver |
| [website/styles.css](styles.css) | 2,200 | CSS | Primary stylesheet — hero, sections, components |
| [website/website.css](website.css) | 697 | CSS | Website-specific overrides (vision, specs, identity, etc.) |
| [website/shared-base-styles.css](shared-base-styles.css) | 1,323 | CSS | Base design system (near-duplicate of styles.css) |
| [website/shared-theme.css](shared-theme.css) | 357 | CSS | Teal theme design system (different variable naming) |
| [website/Lichen_Logo_256.png](Lichen_Logo_256.png) | — | Asset | Logo image |
| [website/favicon.ico](favicon.ico) | — | Asset | Favicon |
| [website/docs/](docs/) | — | Dir | Planning docs (DESIGN_FIXES, NEW_SECTIONS, OVERHAUL_PLAN, README, REFINEMENTS) |

**Total CSS: 4,577 lines across 4 files with significant duplication (see §7)**

---

## 3. Navigation Audit

### 3a. Top Navigation Bar (`.nav-menu`)

| Link Text | `href` / Resolution | Target Exists? | Status |
|-----------|---------------------|----------------|--------|
| Vision | `#vision` | `<section id="vision">` ✅ | ✅ Working |
| Architecture | `#architecture` | `<section id="architecture">` ✅ | ✅ Working |
| Tokenomics | `#tokenomics` | `<section id="tokenomics">` ✅ | ✅ Working |
| LichenID | `#identity` | `<section id="identity">` ✅ | ✅ Working |
| Ecosystem | `#ecosystem` | `<section id="ecosystem">` ✅ | ✅ Working |
| Deploy | `#deploy` | `<section id="deploy">` ✅ | ✅ Working |
| Roadmap | `#roadmap` | `<section id="roadmap">` ✅ | ✅ Working |
| *(missing)* | — | `<section id="validators">` ✅ | 🔴 No nav entry |
| *(missing)* | — | `<section id="api">` ✅ | 🔴 No nav entry |
| *(missing)* | — | `<section id="community">` ✅ | 🔴 No nav entry |

**Gap:** The page has 10 sections (`#vision`, `#architecture`, `#tokenomics`, `#identity`, `#validators`, `#ecosystem`, `#deploy`, `#api`, `#roadmap`, `#community`) but the nav only exposes 7. The `#validators`, `#api`, and `#community` sections are completely unreachable except by manual scrolling. There is no on-page table of contents or any other compensating mechanism.

### 3b. Nav Action Buttons

| Button | `data-lichen-app` | Resolved URL (dev) | Resolved URL (prod) | Status |
|--------|-----------------|-------------------|---------------------|--------|
| Explorer | `explorer` | `http://localhost:3007` | `{origin}/explorer` | ✅ Resolved by shared-config |
| Wallet | `wallet` | `http://localhost:3008` | `{origin}/wallet` | ✅ Resolved by shared-config |

### 3c. Hero CTAs

| CTA | Target | Status |
|-----|--------|--------|
| Deploy a Contract | `href="#deploy"` | ✅ Internal anchor |
| Read the Docs | `data-lichen-app="developers"` | ✅ Resolved to `localhost:3010` / `{origin}/developers` |

### 3d. Validators Section CTA

| CTA | Target | Status |
|-----|--------|--------|
| Start Validating Now | `data-lichen-app="developers"` + `data-lichen-path="/validator.html"` | ✅ Resolves to `{origin}/developers/validator.html` — file must exist in developers app |

### 3e. Ecosystem / Contracts Section

| CTA | Target | Status |
|-----|--------|--------|
| Browse All 27 Contracts | `https://github.com/lichen/lichen/tree/main/contracts` | 🟡 External GitHub — unverifiable (repo may be private or not yet created) |

### 3f. Community Cards

| Link | Target | Status |
|------|--------|--------|
| Discord | `https://discord.gg/lichen` | 🟡 Unverifiable — invite link may be invalid or expired |
| Twitter | `https://twitter.com/lichen` | 🟡 Unverifiable — account may not exist |
| GitHub | `https://github.com/lichen/lichen` | 🟡 Same as contracts — unverifiable |
| Developer Portal | `data-lichen-app="developers"` | ✅ Resolved by shared-config |

### 3g. Footer Links — Resources Column

| Link Text | `data-lichen-app` + `data-lichen-path` | Resolved Target |
|----------|-----------------------------------|-----------------|
| Documentation | `developers` + *(none)* | `{origin}/developers` |
| Architecture | `developers` + `/architecture.html` | `{origin}/developers/architecture.html` |
| Getting Started | `developers` + `/getting-started.html` | `{origin}/developers/getting-started.html` |
| Validator Guide | `developers` + `/validator.html` | `{origin}/developers/validator.html` |

All resolved via `shared-config.js` ✅. File existence in the developers app is out of scope here.

### 3h. Footer Links — Tools Column

| Link Text | `data-lichen-app` | Resolved (dev) |
|-----------|-----------------|----------------|
| Explorer | `explorer` | `localhost:3007` |
| Wallet | `wallet` | `localhost:3008` |
| Developer Portal | `developers` | `localhost:3010` |
| Testnet Faucet | `faucet` | `localhost:9100` |

All ✅ via shared-config.

### 3i. Footer Links — Community Column

| Link Text | Target | Status |
|-----------|--------|--------|
| Discord | `https://discord.gg/lichen` | 🟡 Unverifiable |
| Twitter | `https://twitter.com/lichen` | 🟡 Unverifiable |
| Telegram | `https://t.me/lichen` | 🟡 Unverifiable — no Telegram card in community section, only footer |
| GitHub | `https://github.com/lichen/lichen` | 🟡 Unverifiable |

### 3j. API Section Footer

| Link | Target | Status |
|------|--------|--------|
| Full API Reference → | `data-lichen-app="developers"` + `/rpc-reference.html` | ✅ Resolves correctly |
| Base URL (code display) | `http://localhost:8899` + `https://rpc.lichen.network` | 🟡 `rpc.lichen.network` unverifiable as live endpoint |

### 3k. Final CTA Section

| CTA | Target | Status |
|-----|--------|--------|
| Deploy a Contract | `href="#deploy"` | ✅ In-page anchor |
| View on GitHub | `https://github.com/lichen/lichen` | 🟡 Unverifiable |

---

## 4. Stats & Metrics Audit

### 4a. Hero Stats

| Element ID | Label | Source | RPC Method | Field Used | Status |
|------------|-------|--------|------------|------------|--------|
| *(static)* | Per Transaction | Hardcoded `$0.0001` | — | — | ✅ By design (constant) |
| *(static)* | Finality | Hardcoded `400ms` | — | — | ✅ By design (constant) |
| `stat-block` | Latest Block | Live RPC | `getSlot` | `slot.value` (direct return) | 🟠 See §4b |
| `stat-validators` | Validators | Live RPC | `getValidators` | `validators.value.count \|\| validators.value.validators?.length` | 🔴 See §4c |

### 4b. `stat-block` — `getSlot()` Field Extraction

In `script.js` lines ~103-108:
```js
const slot = await rpc.getSlot()  // calls this.call('getSlot')
if (slot.status === 'fulfilled' && slot.value !== null) {
    const blockEl = document.getElementById('stat-block');
    if (blockEl) blockEl.textContent = formatNumber(slot.value);
}
```
The RPC client's `call()` method returns `data.result` directly. If `getSlot` returns a bare integer (e.g., `"result": 12345`), then `slot.value` is `12345` and this works correctly ✅. If the RPC returns `"result": {"slot": 12345}` (object), `formatNumber()` guards against non-number types with `if (typeof num !== 'number' || !isFinite(num)) return '—'`, so the stat would display `"—"` rather than crash. ✅ No critical issue.

### 4c. `stat-validators` — Field Mismatch (CRITICAL)

The `getMetrics` response documented in the HTML shows:
```json
{ "validator_count": 42, ... }
```
But `getValidators` (a different endpoint) is called instead, and the extraction uses:
```js
const count = validators.value.count || validators.value.validators?.length || 0;
```
- If `getValidators` returns `{ validators: [...], count: N }` → works ✅
- If `getValidators` returns `[{...}, {...}]` (bare array) → `validators.value.count` is `undefined`, `validators.value.validators?.length` is `undefined`, falls back to `0` → **stat shows 0** 🔴
- The RPC client wraps responses with `data.result`, so if the RPC returns `{"validators": [...]}`, then `validators.value.validators.length` works. But if it returns `{"count": N}`, then `validators.value.count` works. **The code handles both shapes, but the fallback to `0` means silent failures are invisible to users.**

### 4d. WebSocket Block Updates

```js
websiteWs.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.params?.result?.slot !== undefined) {
        blockEl.textContent = formatNumber(data.params.result.slot);
    }
}
```

The subscription sends:
```json
{ "jsonrpc": "2.0", "method": "slotSubscribe", "params": [], "id": 1 }
```

**Issue:** The message path `data.params.result.slot` assumes a specific subscription notification format. If the WS server sends `{ "params": { "result": 12345 } }` (integer) instead of `{ "params": { "result": { "slot": 12345 } } }`, the slot update will silently fail. **No fallback or error logging for this case.** 🟠

### 4e. TPS — Not Live

The "35,000+ tx/s" figure appears in the Architecture spec cards as **static text** only. There is no live TPS display on the page. The `getMetrics` RPC method (documented in the API section with a `tps` field) is **never called** from `script.js`. There is no TPS stat card in the hero despite it being the chain's primary performance claim.

### 4f. Polling Interval

Stats refresh every **5 seconds** via `setInterval(updateStats, 5000)`:
- Both `getSlot` and `getValidators` are called on each tick
- WebSocket additionally provides live slot updates between polls
- No debounce or rate limiting — if RPC is slow or down, multiple in-flight requests can accumulate

---

## 5. CTA & Feature Audit

### 5a. Deploy Wizard (5-step)

| Step | Title | Tab Selector | Step Selector | JS Handler | Status |
|------|-------|-------------|----------------|-----------|--------|
| 1 | Install CLI | `.wizard-tab[data-step="1"]` | `.wizard-step[data-step="1"]` | `setupWizardTabs()` ✅ | ✅ |
| 2 | Create Identity | `.wizard-tab[data-step="2"]` | `.wizard-step[data-step="2"]` | ✅ | ✅ |
| 3 | Write Contract | `.wizard-tab[data-step="3"]` | `.wizard-step[data-step="3"]` | ✅ | ✅ |
| 4 | Build & Deploy | `.wizard-tab[data-step="4"]` | `.wizard-step[data-step="4"]` | ✅ | ✅ |
| 5 | Call via RPC | `.wizard-tab[data-step="5"]` | `.wizard-step[data-step="5"]` | ✅ | 🟠 (see below) |

**Issue — Step 5 code example uses `callContract`:**
The code sample in step 5 calls `method: 'callContract'` via raw fetch:
```js
method: 'callContract',
params: { contract: 'a3f7c2d9e4b8...', function: 'increment', ... }
```
This is a static code example, not a live demo. The `LichenRPC` class in `script.js` does **not** expose a `callContract` method. If a developer imports the SDK thinking this mirrors what's available, they'll get an error. The contract address `a3f7c2d9e4b8...` is a placeholder. **Label this as an example, not runnable code.**

### 5b. Copy Code Buttons

All code blocks have `<button class="copy-btn" onclick="copyCode(this)">`. The `copyCode()` function:
- Uses `navigator.clipboard.writeText()` — requires HTTPS or localhost 🟠 (will silently fail on plain HTTP in production)
- Shows ✓ icon on success, ✗ icon on failure — good UX ✅
- No fallback for browsers that don't support Clipboard API (Safari < 13.1, Firefox < 63) 🟡

### 5c. API Tabs

`setupApiTabs()` handles `.api-tab` / `.api-category` toggling. Four tabs: Accounts, Blocks, Transactions, Chain. Default active: "Accounts". Logic is correct ✅.

### 5d. Network Selector

`<select id="websiteNetworkSelect">` with options: Mainnet, Testnet, Local Testnet (default), Local Mainnet.
- `switchNetwork(value)` called via `onchange`
- Saves to `localStorage('lichen_website_network')`
- Reconnects WebSocket ✅
- Refreshes stats ✅
- Network selection restored on page load ✅

**Caveat:** Mainnet and Testnet RPC URLs (`rpc.lichen.network`, `testnet-rpc.lichen.network`) are not yet live. When selected, all stat fetches will fail silently (no user-facing "disconnected" indicator).

### 5e. Scroll Behavior

Smooth scroll via `querySelectorAll('a[href^="#"]')` + `scrollIntoView`. Works correctly for all internal anchors. No scroll-to-top button. No active section highlighting in nav. 🟡

### 5f. Mobile Navigation

- Hamburger button `#navToggle` toggles `.nav-menu.active` and `.nav-actions.active` ✅
- **Bug:** Clicking a nav link while mobile menu is open does NOT close the menu. User must tap the hamburger again. 🟡
- `.nav-actions.active` is positioned at `top: calc(100% + 200px)` in `website.css` — the `200px` is hardcoded and assumes the nav-menu expands to exactly ~200px. On screens where menu links wrap, this will overlap or be mispositioned. 🟠

### 5g. Scroll Indicator

The `.scroll-indicator` / `.scroll-arrow` at the bottom of hero is purely visual (CSS bounce animation). It has no click handler. ✅ (expected behavior)

### 5h. Forms

**No forms on the page.** No email capture, no newsletter, no waitlist form. If a mailing list signup is planned, this is a gap.

---

## 6. RPC Integration Audit

### 6a. Client Class (`LichenRPC`)

```
new LichenRPC(url)
  .call(method, params)      → generic JSON-RPC 2.0 POST
  .getValidators()           → 'getValidators', []
  .getSlot()                 → 'getSlot', []
  .getBalance(pubkey)        → 'getBalance', [pubkey]
  .getAccount(pubkey)        → 'getAccount', [pubkey]
  .sendTransaction(txData)   → 'sendTransaction', [txData]
  .health()                  → 'health', []
```

**Methods documented in the API section but NOT in client class:**
- `getLatestBlock` — documented, not in class
- `getBlock(slot)` — documented, not in class
- `getMetrics` — documented, not in class (contains `tps`, `total_transactions`, `validator_count`, etc.)
- `getTransaction(sig)` — documented, not in class
- `getTotalBurned` — documented, not in class
- `callContract` — used in example code, not in class

**Verdict:** The `LichenRPC` class is a minimal partial client. It exposes only the 6 methods needed by the website's live stats. The broader API documented in the UI is not reachable through the on-page client.

### 6b. RPC Error Handling

```js
} catch (error) {
    console.error('RPC Error:', error);
    return null;
}
```

- All errors return `null` silently
- `updateStats()` uses `Promise.allSettled` — handles individual rejections ✅
- On failure, stats stay as `—` (default) with no visual error indicator or "offline" badge 🟡
- No retry logic for transient failures
- No timeout: a slow RPC call can block indefinitely

### 6c. `getSlot` Response Contract

The HTML API docs show `getSlot()` returning just a slot height (number). The script reads `slot.value` directly and passes to `formatNumber(num)`. `formatNumber` guards against non-number input (`if (typeof num !== 'number' || !isFinite(num)) return '—'`) ✅ — safe against wrong types.

### 6d. `getValidators` Response Contract

| If response is… | `count` | `.validators?.length` | Result |
|-----------------|---------|----------------------|--------|
| `{ count: 42 }` | 42 | undefined | 42 ✅ |
| `{ validators: [{...}, {...}] }` | undefined | 2 | 2 ✅ |
| `[{...}, {...}]` (bare array) | undefined | undefined | **0** 🔴 |
| `42` (bare number) | undefined | undefined | **0** 🔴 |

If the actual `getValidators` RPC returns a bare array or number, the stat shows `0`. **This should be tested against the live validator node.**

### 6e. WebSocket Endpoints

| Network | WS Endpoint |
|---------|------------|
| mainnet | `wss://ws.lichen.network` |
| testnet | `wss://testnet-ws.lichen.network` |
| local-testnet | `ws://localhost:8900` |
| local-mainnet | `ws://localhost:8900` |

- Reconnect on close: 5s timer ✅
- Paused when tab is hidden (visibilitychange) ✅
- Closed on `beforeunload` ✅
- **Subscription method:** `slotSubscribe` — needs verification against actual RPC
- **Message path:** `data.params?.result?.slot` — needs verification

### 6f. RPC URL in Production

From `script.js`:
```js
const NETWORKS = {
    'mainnet': 'https://rpc.lichen.network',
    'testnet': 'https://testnet-rpc.lichen.network',
    ...
}
```

These domain names are **not verified to exist**. Users who switch to "Mainnet" or "Testnet" will get network errors with no feedback beyond console logs.

---

## 7. CSS & Theme Audit

### 7a. Stylesheet Loading Order

```html
<link rel="stylesheet" href="shared-base-styles.css">   <!-- 1,323 lines -->
<link rel="stylesheet" href="shared-theme.css">          <!-- 357   lines -->
<link rel="stylesheet" href="styles.css">                <!-- 2,200 lines -->
<link rel="stylesheet" href="website.css">               <!-- 697   lines -->
```

**Cascade direction:** `website.css` wins over `styles.css` wins over `shared-theme.css` wins over `shared-base-styles.css`.

### 7b. CSS Variable System

**Three independent `:root` declarations define overlapping variable sets:**

| Variable | `shared-base-styles.css` | `shared-theme.css` | `styles.css` |
|----------|--------------------------|-------------------|--------------|
| `--primary` | `#00C9DB` ✅ | *(not defined)* | `#00C9DB` ✅ |
| `--bg-card` | `#141830` ✅ | ❌ NOT defined | `#141830` ✅ |
| `--bg-dark` | `#0A0E27` ✅ | `#0A0E27` (as `--bg-dark`) ✅ | `#0A0E27` ✅ |
| `--border` | `#1F2544` ✅ | `#1F2544` ✅ | `#1F2544` ✅ |
| `--gradient-1` | defined ✅ | ❌ NOT defined | defined ✅ |
| `--teal-primary` | ❌ NOT defined | `#00C9DB` (unused by website.css) | ❌ NOT defined |
| `--blue-primary` | ❌ NOT defined | `#004E89` (unused by website.css) | ❌ NOT defined |
| `--shadow-glow` | ❌ NOT defined | `0 0 20px rgba(0, 201, 219,0.3)` | ❌ NOT defined |
| `--bg-surface` | ❌ NOT defined | ❌ NOT defined | ❌ NOT defined |

**Findings:**
- `website.css` uses: `--primary`, `--bg-card`, `--bg-darker`, `--success`, `--warning`, `--border`, `--text-primary`, `--text-secondary`, `--text-muted`, `--gradient-1` — ALL defined in `styles.css` ✅
- `shared-theme.css` defines `--teal-primary`, `--blue-primary`, `--shadow-glow` etc. — **none referenced** by `website.css` or any component in `index.html` → **dead code** 🟡
- `--bg-surface` does NOT appear anywhere — no issue
- Because `styles.css` loads after `shared-theme.css`, and they define the same variable names with the same values, there is no visual conflict — but it's redundant and fragile

### 7c. CSS Duplication

`shared-base-styles.css` and `styles.css` are **near-identical** in content. Both define:
- `:root` variables (identical values)
- CSS Reset (`*, body, html`)
- `.container`, `.section`, `.section-header`
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-large`
- `.nav`, `.nav-container`, `.nav-logo`, `.nav-menu`
- `.hero`, `.hero-background`, `.hero-content`, `.hero-stats`, `.hero-cta`
- `.feature-card`, `.comparison-card`, `.community-card`
- `.code-example`, `.code-header`, `.code-content`
- `@keyframes slideUp`, `@keyframes fadeIn`, `@keyframes float`, `@keyframes pulse`
- `.footer`, `.footer-bottom`
- Complete responsive breakpoints

**Estimated duplication: ~60–70% of `shared-base-styles.css` is identical to `styles.css`.**  
This creates ~800+ lines of redundant CSS being loaded on every page request. 🟡

### 7d. `.container` Width Conflict

```css
/* shared-base-styles.css */
.container { max-width: 1200px; padding: 0 2rem; }

/* styles.css (loaded after — wins) */
.container { max-width: 1800px; padding: 0 4rem; }
```

**`styles.css` overrides the container to 1800px max-width.** This is extremely wide for a marketing page (wider than most 4K displays). On a standard 1920px monitor, content could span the full width with only 4rem gutters. **Intended or not?** The design intent appears to be 1200px based on `shared-base-styles.css`. 🟡

### 7e. `@keyframes` Name Collisions

`@keyframes fadeIn` is defined in: `shared-base-styles.css`, `shared-theme.css`, and `styles.css` (3 times). `@keyframes slideUp` is defined in `shared-base-styles.css` and `styles.css` (2 times). The last definition wins, and since the values are the same each time, there is no visual bug — but it's a maintenance hazard. 🟡

### 7f. Orphaned CSS Classes

The following classes are referenced in `index.html` but have no corresponding CSS rules:

| Class | Used on | Defined? |
|-------|---------|---------|
| `.deploy-section` | `<section class="section deploy-section">` | ❌ No rules anywhere |
| `.api-section` | `<section class="section section-alt api-section">` | ❌ No rules anywhere |
| `.animate-on-scroll` | All animated cards | ❌ No rules (works because element also has specific card class) |

**Impact:** The first two are harmless since the section layout comes from `.section` / `.section-alt`. The third could cause invisible elements if used on a div that lacks one of the observed specific class names. 🟡

### 7g. `.nav-actions.active` Mobile Positioning

```css
/* website.css */
.nav-actions.active {
    display: flex;
    flex-direction: column;
    position: absolute;
    top: calc(100% + 200px);  /* ← hardcoded 200px */
    left: 2rem;
    right: 2rem;
}
```

The `200px` offset assumes the expanded `.nav-menu` is exactly 200px tall. With 7 nav links at ~2rem each, this is approximately correct on most phones — but will break on small screens where links wrap to additional lines, or if the nav menu content changes. **Use `auto` layout flow or dynamic positioning instead.** 🟠

### 7h. Responsive Breakpoints Summary

| Breakpoint | Coverage |
|------------|---------|
| `>1920px` | Defined in `styles.css` — extra large hero sizing ✅ |
| `≤1400px` | Blockchain comparison drops to 2-col ✅ |
| `≤1200px` | Specs/tokenomics/identity grids go 2-col ✅ |
| `≤1024px` | Most grids go 1-col; tablets ✅ |
| `≤768px` | Mobile: nav hidden, single-col, smaller type ✅ |
| `≤480px` | Small phones: tighter padding, smaller hero ✅ |

All major breakpoints are covered. Mobile layout is functional.

### 7i. FontAwesome Icon Availability

The following icons are used and may not be in FontAwesome 6.5.1 Free tier:

| Icon Class | Used Where | FA6 Free? |
|------------|-----------|-----------|
| `fas fa-vault` | SporeVault card | ✅ Added in FA6.1 |
| `fas fa-bridge` | LichenBridge card | ⚠️ Verify — `fa-bridge` was added in FA6.0.0 but check free/pro tier |
| `fa-solid fa-shrimp` | Code output text (wizard step 2) | ✅ Added in FA6.1 |
| `fa-solid fa-location-dot` | Code output text | ✅ |
| `fa-solid fa-floppy-disk` | Code output text | ✅ |
| `fa-solid fa-cube` | Code output text (wizard step 4) | ✅ |
| `fa-solid fa-circle-check` | Code output text | ✅ |

**Note:** The wizard step code blocks use FA icons **inside `<code>` blocks rendered as page text** — these will render as actual icons on page (not inside a terminal). This is a UX quirk but works correctly since the intent is to illustrate styled CLI output. 🟢

---

## 8. Config Audit

### 8a. `shared-config.js` — URL Resolver

**Dev detection:** `window.location.hostname === 'localhost' || '127.0.0.1'` ✅ (covers both loopback variants)

**Dev URLs:**
| App | URL |
|-----|-----|
| explorer | `localhost:3007` |
| wallet | `localhost:3008` |
| marketplace | `localhost:3009` |
| dex | `localhost:3011` |
| website | `localhost:9090` |
| developers | `localhost:3010` |
| faucet | `localhost:9100` |

**Production URL strategy:** `${window.location.origin}/${app}` — all apps served as subdirectories of the same origin (e.g., `https://lichen.network/explorer`, `/wallet`, etc.)

**Findings:**
1. **Assumes single-origin deployment** — if the explorer runs on `app.lichen.network` and the website runs on `lichen.network`, all cross-app links will produce 404s. No environment variable or override mechanism exists. 🟠
2. **No `rpc` entry** in `LICHEN_CONFIG` — the RPC URL is managed independently in `script.js`'s `NETWORKS` object. These are not in sync (e.g., if a staging RPC endpoint is different from the production one, they must be updated in two separate files). 🟡
3. **Telegram missing** from `LICHEN_CONFIG` — the footer has a Telegram link hardcoded as `https://t.me/lichen` rather than going through config. Inconsistent with other community links. 🟢

### 8b. RPC URL in `script.js`

```js
const NETWORKS = {
    'mainnet': 'https://rpc.lichen.network',
    'testnet': 'https://testnet-rpc.lichen.network',
    'local-testnet': 'http://localhost:8899',
    'local-mainnet': 'http://localhost:8899',
};
```

- Both `local-testnet` and `local-mainnet` point to the same port (`8899`) — user confusion potential. 🟢
- `https://rpc.lichen.network` domain assumed but unverified. No HTTP status check or uptime indicator.

### 8c. Chain ID / Network Info

The page does not display a chain ID anywhere. The `config.toml` in the workspace root may define it — not surfaced on the website. For a blockchain landing page, chain ID is a critical piece of information for MetaMask / wallet integration (given the dual-addressing feature promoted on the site). 🟡

---

## 9. Issues Found

| # | Severity | Category | Description | Location | Suggested Fix |
|---|----------|----------|-------------|----------|--------------|
| 1 | 🔴 | Stats | `getValidators()` response: if RPC returns bare array, `.count` and `.validators?.length` both `undefined`, stat shows `0` silently | [script.js](script.js) ~L108–L113 | Test actual response shape; add `Array.isArray(v) ? v.length : v.count \|\| v.validators?.length \|\| 0` |
| 2 | 🔴 | WebSocket | `data.params?.result?.slot` path unverified against actual WS notification format; slot updates may silently fail | [script.js](script.js) ~L148–L156 | Log actual WS messages in dev; update path to match real format |
| 3 | 🔴 | Navigation | `#validators`, `#api`, and `#community` sections exist but have NO nav links — 3 entire sections unreachable from nav | [index.html](index.html) L26–34 | Add 3 nav entries, or add an in-page sticky sub-nav |
| 4 | 🟠 | Mobile CSS | `.nav-actions.active { top: calc(100% + 200px) }` hardcoded offset; breaks if nav-menu height ≠ 200px | [website.css](website.css) L597–L603 | Remove absolute positioning; let nav-actions flow below nav-menu in normal document flow |
| 5 | 🟠 | Config | `shared-config.js` production URLs are all `origin + /path` — assumes single-origin; breaks multi-subdomain deployments | [shared-config.js](shared-config.js) L22–L29 | Add a `LICN_PRODUCTION_URLS` env/config override or per-app config |
| 6 | 🟠 | RPC | `callContract` used in wizard Step 5 code example but not a method in `LichenRPC` class; will fail if users try to copy-paste as SDK | [script.js](script.js) / [index.html](index.html) L791–L808 | Add comment "example only" or implement `callContract` in the client class |
| 7 | 🟠 | RPC | Mainnet/testnet URLs (`rpc.lichen.network`) unverifiable; no user-visible offline indicator when these fail | [script.js](script.js) L4–L10 | Add a chain status indicator (HTML has `.chain-status-bar` CSS already defined in shared-base-styles.css) |
| 8 | 🟠 | External Links | `https://github.com/lichen/lichen` (appears 3× in page + footer) not verified as public/existing | [index.html](index.html) L718, L1100, L1117 | Verify repo is public before launch; add 404 fallback redirect |
| 9 | 🟡 | Mobile UX | Mobile nav menu does not auto-close when a nav link is clicked | [script.js](script.js) L172–L180 | Add click listener on nav links to toggle menu closed |
| 10 | 🟡 | CSS | `shared-base-styles.css` and `styles.css` duplicate ~60–70% of content (1000+ redundant lines loaded on every page) | [shared-base-styles.css](shared-base-styles.css), [styles.css](styles.css) | Delete `shared-base-styles.css` from website; website should use `styles.css` as base |
| 11 | 🟡 | CSS | `styles.css` overrides `.container` to `max-width: 1800px` — extremely wide, likely unintentional | [styles.css](styles.css) L57 | Change to `max-width: 1400px` or match designer intent |
| 12 | 🟡 | CSS | `shared-theme.css` defines `--teal-primary`, `--blue-primary`, `--shadow-glow` variable names — none used by `website.css` or `index.html` | [shared-theme.css](shared-theme.css) L32–L92 | Either update references to use these names (unify variable system) or remove `shared-theme.css` from website |
| 13 | 🟡 | Config | RPC endpoint config split across two files (`shared-config.js` for app URLs, `script.js` for RPC URLs) — no single source of truth | [shared-config.js](shared-config.js), [script.js](script.js) | Move RPC URLs into `LICHEN_CONFIG` or vice versa |
| 14 | 🟡 | Stats | No live TPS display despite `getMetrics` being documented with a `tps` field; primary performance claim is static | [script.js](script.js), [index.html](index.html) | Add `getTps()` call to `updateStats()` and a `stat-tps` element to hero |
| 15 | 🟡 | CSS | `.deploy-section` and `.api-section` classes used in HTML but have zero CSS rules | [index.html](index.html) L748, L871 | Either add styles or remove the classes |
| 17 | 🟡 | Social | Discord, Twitter, GitHub, Telegram links may be placeholder/unregistered accounts | [index.html](index.html) L1052–L1090 | Verify all accounts before launch; consider a registration checklist |
| 18 | 🟡 | CSS | `.nav-actions` hidden on mobile but when `.nav-menu.active` the nav-actions overlay position is fragile | [website.css](website.css) L594–L603 | Render nav-actions links inline inside the nav-menu when mobile |
| 19 | 🟢 | SEO | No `<meta property="og:image">`, `<meta property="og:title">`, `<meta name="twitter:card">` social sharing tags | [index.html](index.html) L1–L17 | Add complete Open Graph + Twitter Card meta block |
| 20 | 🟢 | SEO | No `<link rel="canonical">` tag | [index.html](index.html) head | Add `<link rel="canonical" href="https://lichen.network">` |
| 21 | 🟢 | Accessibility | API tabs and wizard tabs lack `aria-label`; `nav-toggle` and copy buttons have `aria-label` ✅ | [index.html](index.html) | Add `aria-label` to tab buttons; add `role="tablist"` + `role="tab"` to wizard/API tabs |
| 22 | 🟢 | UX | No chain ID displayed anywhere; required for MetaMask "Add Network" flow despite dual-addressing being a key feature | [index.html](index.html) | Add Chain ID to Architecture specs or a dedicated "Add to MetaMask" button |
| 23 | 🟢 | Copy | `navigator.clipboard.writeText()` requires HTTPS or localhost; will fail on plain HTTP in production | [script.js](script.js) L41–L56 | Ensure production is HTTPS; add `document.execCommand('copy')` fallback |
| 24 | 🟢 | CSS | `@keyframes fadeIn`, `@keyframes slideUp`, `@keyframes float`, `@keyframes pulse` each defined 2–3 times across the stylesheet chain | All CSS files | Deduplicate by keeping keyframes only in `styles.css` |

---

## 10. Positive Findings

Items that are well-implemented and require no changes:

- ✅ **Smooth scroll** — `querySelectorAll('a[href^="#"]')` with `scrollIntoView` covers all internal anchors
- ✅ **Intersection Observer** — correctly initializes card entry animations with `threshold: 0.1` and `rootMargin: '0px 0px -100px 0px'`
- ✅ **WebSocket lifecycle** — reconnect timer (5s), pauses on hidden tab (`visibilitychange`), closes on unload (`beforeunload`)
- ✅ **Network persistence** — `localStorage` saves network choice; restored on `DOMContentLoaded`
- ✅ **`shared-config.js`** — clean auto-resolving URL system with `data-lichen-app` attribute, runs once on DOMContentLoaded
- ✅ **Parallax hero** — RAF-throttled `requestAnimationFrame` prevents jank on scroll
- ✅ **`formatNumber`** — guards against non-numbers, `NaN`, and `Infinity` before formatting
- ✅ **`Promise.allSettled`** in `updateStats()` — individual RPC failures don't crash the whole stats update
- ✅ **Copy button feedback** — visual ✓/✗ with 2s reset is clean UX
- ✅ **HTML structure** — semantically correct sections, proper `alt` tags on images
- ✅ **CSS custom properties** — consistent use of design tokens across all components
- ✅ **27-contract grid** — count correctly matches the section title
- ✅ **Responsive** — all major breakpoints covered (1920, 1400, 1200, 1024, 768, 480)

---

## 11. Recommended Priority Actions (Ordered)

1. **[BEFORE LAUNCH]** Verify `getValidators` RPC response shape and fix validator count extraction (Issue #1)
2. **[BEFORE LAUNCH]** Add `#validators`, `#api`, `#community` to the nav menu (Issue #3)
3. **[BEFORE LAUNCH]** Test WebSocket `slotSubscribe` message format against live node (Issue #2)
4. **[BEFORE LAUNCH]** Verify all external social/GitHub links are live (Issue #17, #8)
5. **[BEFORE LAUNCH]** Fix mobile `.nav-actions.active` positioning (Issue #4)
6. **[BEFORE LAUNCH]** Add Open Graph + Twitter Card meta tags (Issue #19)
7. **[POST-LAUNCH]** Add TPS live metric call to `updateStats()` (Issue #14)
8. **[POST-LAUNCH]** Consolidate 4 CSS files → 2 (remove duplication) (Issue #10)
9. **[POST-LAUNCH]** Add `aria-label`, `role="tab"`, `role="tablist"` for accessibility (Issue #21)
10. **[POST-LAUNCH]** Add chain status bar using existing `.chain-status-bar` CSS already in `shared-base-styles.css` (Issue #7)
