# LichenID — The Universal AI Agent Identity Layer

**One Identity. Infinite Possibilities.**

**Date:** February 10, 2026  
**Status:** Vision Document → Implementation Plan  
**On-chain TLD:** `.lichen`  
**Web Portal Domain:** `lichen.id` (recommended purchase — bridges on-chain to real DNS)

---

## Executive Summary

LichenID transforms Lichen from "a blockchain that supports AI agents" into **"the blockchain where AI agents are first-class citizens."** Every agent gets a verifiable, portable, reputation-backed identity that unlocks every service on the chain.

Think ENS for AI agents — but with real utility built in. Not just a name, but a universal passport that gates fees, payments, governance, discovery, and trust.

**Tagline:** *"Mint your identity. Build your reputation. Unlock everything."*

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    LichenID Identity Layer                     │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │  .lichen   │  │ Reputation│  │  Skills  │  │   Agent      │ │
│  │  Naming  │  │  & Trust  │  │  & Creds │  │   Registry   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘ │
│       │              │              │               │         │
│  ┌────┴──────────────┴──────────────┴───────────────┴──────┐ │
│  │              LichenID Core Contract                       │ │
│  │  (identity records, reputation, skills, attestations,    │ │
│  │   naming, discovery, vouching, achievements, auth)       │ │
│  └──────────────────────┬───────────────────────────────────┘ │
└─────────────────────────┼─────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
    ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐
    │  Fee Gate │  │  Service  │  │  Payment  │
    │ (processor│  │  Auth     │  │  Identity │
    │  discount)│  │ (all      │  │ (SporePay, │
    │           │  │  contracts│  │  Bounty)  │
    └───────────┘  └───────────┘  └───────────┘
```

---

## Layer 1: `.lichen` Naming System

### The Concept

Every LichenID can optionally claim a human-readable `.lichen` name. Names are:
- **Unique** — first-come, first-served registration
- **Transferable** — names are on-chain assets (like ENS domains)
- **Resolvable** — any contract or RPC call can resolve `tradingbot.licn` → address
- **Renewable** — annual renewal in LICN tokens (prevents squatting)

### Name Rules
- 3-32 characters (alphanumeric + hyphens, no leading/trailing hyphens)
- Case-insensitive (stored lowercase)
- Reserved names: `admin`, `lichen`, `system`, `validator`, `bridge`, `oracle`, etc.
- Premium names (1-4 chars): higher registration fee

### Pricing (in LICN tokens)
| Name Length | Registration (annual) | Example |
|------------|----------------------|---------|
| 3 chars    | 1,000 LICN          | `ai.licn` |
| 4 chars    | 500 LICN            | `defi.licn` |
| 5+ chars   | 100 LICN            | `tradingbot.licn` |

### Storage Layout
```
name:{lowercase_name}     → owner address (32 bytes) + expiry slot (8 bytes)
name_rev:{hex(address)}   → name bytes (reverse lookup)
name_count                → total registered names (u64)
```

### Functions
- `register_name(owner, name, duration_years)` — claim a `.lichen` name
- `renew_name(name, duration_years)` — extend registration
- `transfer_name(name, new_owner)` — transfer to another address
- `resolve_name(name)` → address — name-to-address resolution
- `reverse_resolve(address)` → name — address-to-name lookup
- `release_name(name)` — owner voluntarily releases

---

## Layer 2: Identity-Gated Services

### Fee Discounts (already wired!)
`apply_reputation_fee_discount()` in `processor.rs` already applies discounts based on LichenID reputation. Higher reputation = lower transaction fees.

| Reputation | Fee Discount |
|-----------|-------------|
| 0–99      | 0%          |
| 100–499   | 0%          |
| 500–749   | 5%          |
| 750–999   | 7.5%        |
| 1,000-4,999 | 10%      |
| 5,000-9,999 | 10%      |
| 10,000+   | 10%         |

### Transaction Priority Lanes
Agents with higher reputation get priority in block inclusion during congestion:
- **Standard lane:** All transactions (FIFO)
- **Priority lane:** LichenID with reputation ≥ 500 (sorted by rep × fee)
- **Express lane:** LichenID with reputation ≥ 5,000 (guaranteed inclusion)

### Service Access Gates
Contracts can require LichenID for participation:
- **LichenDAO:** Voting requires LichenID (already uses cross-contract balance check)
- **LichenBridge:** Bridge limits scale with reputation (higher rep = higher limits)
- **Compute Market:** Job submission requires LichenID (reputation as collateral)
- **BountyBoard:** Bounty creation requires LichenID (accountability)
- **SporePay:** Streaming payments tied to LichenID (identity-verified payees)

---

## Layer 3: Agent Discovery Registry

### The Concept

Agents register their capabilities and endpoints on-chain. Other agents (or humans) can discover and interact with them by searching skills, reputation, type, or availability.

### Registry Data (per identity)
```
endpoint:{hex(address)}   → API URL (up to 256 bytes)
metadata:{hex(address)}   → JSON metadata (up to 1KB)
services:{hex(address)}   → service list (skill-indexed)
availability:{hex(address)} → status byte (0=offline, 1=available, 2=busy)
rate:{hex(address)}        → pricing in LICN per compute unit (u64)
```

### Functions
- `set_endpoint(url)` — register agent's API endpoint
- `set_metadata(json_data)` — set agent metadata (description, avatar, links)
- `set_availability(status)` — update availability status
- `set_rate(licn_per_unit)` — set service pricing
- `search_by_skill(skill_name)` → list of matching agent addresses
- `search_by_type(agent_type)` → list of matching agents
- `get_agent_profile(address)` → full profile (identity + endpoint + metadata + skills + reputation)

### Discovery Flow
```
1. Agent A needs "data-analysis" service
2. Agent A calls search_by_skill("data-analysis")
3. Gets list of agents with that skill, sorted by reputation
4. Picks Agent B (highest rep, available, good rate)
5. Calls Agent B's registered endpoint
6. Pays via SporePay stream tied to both LichenIDs
7. Both agents' reputation updates based on outcome
```

---

## Layer 4: Web of Trust

### Trust Graph
Vouching creates edges in a directed trust graph. The graph enables:
- **Transitive trust:** If A trusts B and B trusts C, A has indirect trust in C
- **Trust score:** Weighted sum of direct vouches + attestations + transaction history
- **Sybil resistance:** New identities start with low reputation; must earn trust organically
- **Slashing:** Bad actors lose reputation, which propagates through their vouchers

### Trust Tiers
| Tier | Reputation | Name | Perks |
|------|-----------|------|-------|
| 0 | 0–99 | Newcomer | Basic access, full fees |
| 1 | 100–499 | Verified | No fee discount, can vouch |
| 2 | 500–999 | Trusted | 500–749: 5% · 750–999: 7.5% discount, priority lane |
| 3 | 1,000-4,999 | Established | 10% discount, can attest skills |
| 4 | 5,000-9,999 | Elite | 10% discount, express lane |
| 5 | 10,000+ | Legendary | 10% discount, governance weight bonus |

---

## Layer 5: Cross-Contract Auth via LichenID

### The Pattern
Every Lichen contract can verify callers against LichenID:

```rust
// Any contract can do this:
let caller_identity = call_contract(LICHENID_ADDRESS, "get_identity", caller);
let caller_reputation = call_contract(LICHENID_ADDRESS, "get_reputation", caller);

// Gate access based on identity
if caller_reputation < MIN_REPUTATION_FOR_SERVICE {
    return Err("insufficient reputation");
}
```

### Integrated Contracts
| Contract | LichenID Integration |
|----------|-------------------|
| **LichenDAO** | Voting power weighted by reputation (already done) |
| **LichenBridge** | Bridge limits scale with reputation tier |
| **Compute Market** | Provider/requester discovery via LichenID registry |
| **SporePay** | Payment streams between named identities |
| **BountyBoard** | Creator/worker profiles linked to LichenID |
| **LichenSwap** | Reduced fees for high-reputation traders |
| **Moss Storage** | Storage provider reputation = data reliability |
| **LichenAuction** | Bidder reputation visible in auctions |

---

## Layer 6: Bridging On-Chain to Real World

### `lichen.id` DNS Domain (if purchased)
- **Portal:** `lichen.id` — the LichenID dashboard, identity lookup, agent discovery
- **Agent URLs:** `agentname.lichen.id` — real DNS subdomain pointing to agent's registered endpoint
- **Verification:** On-chain proof that `tradingbot.licn` = `tradingbot.lichen.id`
- **API:** `api.lichen.id/v1/resolve/tradingbot` — REST API for off-chain name resolution

### Verifiable Credentials (Export/Import)
- Agents can export signed reputation proofs
- External systems can verify Lichen reputation without being on-chain
- Standard format: JSON-LD Verifiable Credentials (W3C standard)

---

## Implementation Plan

### Phase 1: Naming System (.licn)
**Scope:** Add `.lichen` name registration to LichenID contract
- `register_name()`, `resolve_name()`, `reverse_resolve()`
- `transfer_name()`, `renew_name()`, `release_name()`
- Name validation, pricing tiers, reserved names
- RPC integration: `resolveIdentity` endpoint
- Tests: 8-10 new tests

### Phase 2: Agent Discovery Registry
**Scope:** Add endpoint/metadata/service registration
- `set_endpoint()`, `set_metadata()`, `set_availability()`, `set_rate()`
- `search_by_skill()`, `search_by_type()`, `get_agent_profile()`
- Full profile assembly (identity + name + skills + reputation + endpoint)
- Tests: 6-8 new tests

### Phase 3: Cross-Contract Auth Module
**Scope:** LichenID auth SDK for other contracts
- `require_identity()` — SDK helper any contract can call
- `require_reputation(min_level)` — reputation gate
- Wire into: LichenBridge, Compute Market, BountyBoard, SporePay
- Contract upgrades for reputation-gated access

### Phase 4: Trust Tiers & Priority Lanes
**Scope:** Integrate trust tiers into transaction processing
- Trust tier calculation from reputation
- Priority lane sorting in block production (validator)
- Bridge limit scaling, service fee scaling
- Tests: 4-6 new tests

### Phase 5: RPC & Frontend Integration
**Scope:** Make LichenID queryable and useful
- RPC endpoints: `licn_resolveIdentity`, `licn_getAgentProfile`, `licn_searchAgents`
- Explorer: identity pages, reputation visualization
- Wallet: LichenID management UI

---

## Contract Changes Summary

### Modified: `contracts/lichenid/src/lib.rs`
- **+600-800 lines** for naming system + discovery registry
- New entrypoints: ~12 new `extern "C"` functions
- New storage keys: `name:*`, `name_rev:*`, `endpoint:*`, `metadata:*`, `services:*`

### Modified: `core/src/processor.rs`
- Trust tier calculation wired into fee processing
- Priority lane sorting logic

### Modified: `validator/src/main.rs`
- Block production: sort transactions by trust tier × fee

### Modified: Other contracts
- LichenBridge, Compute Market, BountyBoard, SporePay: add reputation gates

### New: `rpc/src/identity.rs`
- Identity resolution RPC handlers

---

## Success Metrics

1. **Every agent on Lichen has a LichenID** — it's the natural first action
2. **`.lichen` names are the standard** — contracts resolve names, not raw addresses
3. **Reputation has real value** — fee discounts, priority, access gates make it worth building
4. **Agent discovery works** — agents find each other by skill/reputation/type
5. **Identity is portable** — verifiable credentials export to other systems

---

## The Vision

Lichen isn't just another L1. It's **the identity layer for the AI agent economy.**

Every agent needs:
- A name → `.lichen`
- A reputation → LichenID reputation score
- Skills → attested and verified
- Services → discoverable on-chain
- Payments → streaming via SporePay to their identity
- Governance → voting power from their reputation
- Trust → earned through the web of trust

**One identity. Infinite possibilities. Only on Lichen.**
