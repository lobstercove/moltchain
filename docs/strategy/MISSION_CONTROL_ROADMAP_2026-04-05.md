# Mission Control Roadmap

Date: 2026-04-05
Owner: Portal and operator surfaces
Scope: Monitoring portal and public portal production defaults

## Objective

Mission Control should behave like an operator control room, not just a public stats page. It needs to expose the health of the live testnet, surface protocol control-plane state, and make it obvious when infrastructure or economic controls drift.

## Current Baseline

The monitoring portal now provides:

- Live validator and RPC health from cluster data
- Endpoint telemetry for RPC and WebSocket slot feed health
- Supply accounting that separates circulating, burned, genesis-held, and staked balances
- Contract registry and deployment coverage by category
- Ecosystem coverage for bridge, oracle, storage, wrapped assets, shielded pool, and marketplace surfaces
- Protocol Control Plane coverage for fees, rent, MossStake, rewards, incidents, and signed metadata registry health

Production-facing public portals are also pinned to testnet by default until mainnet is intentionally launched.

## Confirmed Operator Surfaces In Repo

These RPC methods are already present and should anchor the next monitoring passes:

- `getMetrics`
- `getPeers`
- `getClusterInfo`
- `getValidators`
- `getNetworkInfo`
- `getProgramStats`
- `getProgramCalls`
- `getFeeConfig`
- `getRentParams`
- `getMossStakePoolInfo`
- `getRewardAdjustmentInfo`
- `getIncidentStatus`
- `getSignedMetadataManifest`
- `getLichenOracleStats`
- `getLichenBridgeStats`
- `getShieldedPoolState`

## What Was Missing

The monitoring portal previously had good top-line activity data, but it was still missing several operator-grade views:

- A protocol policy and control-plane section
- A roadmap that defines what a full control room should include
- Explicit infrastructure boards for network, validator, and RPC fleet status
- Program-level hotspot visibility for contract call pressure and failure concentration
- Treasury and reward-distribution visibility

## Shipped In This Pass

- Full-height contract registry and list panels with internal scrolling only when needed
- Removal of per-refresh row animations that caused the visible block and event-feed blip
- A new Protocol Control Plane section powered by live RPC methods
- Production testnet-default normalization across public portals that still assumed mainnet

## Next Highest-Value Sections

### 1. Treasury And Distribution Board

Show treasury, community, reserve, and builder wallets alongside reward flow percentages from `getFeeConfig`. This should answer where value is accumulating and whether allocations still match protocol policy.

### 2. Network Infrastructure Board

Use `getClusterInfo`, `getValidators`, and `getNetworkInfo` to show validator versions, region spread, peer density, and any node skew across the three-VPS testnet footprint.

### 3. Program Hotspots Board

Use `getProgramStats` and `getProgramCalls` to expose which contracts are receiving the most traffic, failing the most often, or accumulating abnormal latency.

### 4. Governance And Incident Watch Surface

Expand the incident and control-plane area into a unified operator watch surface that shows active incident mode, severity, governance toggles, and signed metadata freshness on one row.

### 5. Privacy Pool Audit Board

Deepen shielded-pool coverage beyond aggregate balance and pool size. Track root churn, note commitment growth rate, and any mismatch between shielded activity and surrounding liquidity surfaces.

### 6. Oracle And Bridge Deep Health

Expose per-feed freshness, last update age, bridge mint and lock ratios, and any divergence between wrapped supplies and bridge custody expectations.

### 7. Service Fleet Board

Track operator-managed services directly: validator, RPC, WebSocket, faucet, and custody. The public monitoring portal should make it obvious which services are expected to be live on which VPS.

## Execution Order

Recommended order for the next implementation passes:

1. Network Infrastructure Board
2. Treasury And Distribution Board
3. Program Hotspots Board
4. Service Fleet Board
5. Oracle And Bridge Deep Health
6. Privacy Pool Audit Board
7. Governance And Incident Watch Surface polish

## Production Policy

Until the mainnet launch is explicit and operator-confirmed, all public production portals should continue to default to testnet and should not present mainnet as the primary live environment.# Lichen Mission Control Roadmap

Updated: 2026-04-05

## Objective

Turn Monitoring into an operator-grade control room for the currently live testnet rollout.

The page should answer four questions immediately:

1. Is the chain healthy right now?
2. Are the operator-controlled services healthy right now?
3. Are the protocol control-plane settings and trust surfaces what we expect?
4. What changed recently enough that an operator should care?

## Current Baseline

Already implemented in the monitoring portal:

- Validator status and network health bars
- Explicit RPC latency and WebSocket slot-feed telemetry
- Supply economics with circulating and non-circulating accounting
- Contract registry and smart-contract deployment monitor
- Recent blocks and live event feed
- DEX, identity, trading, prediction, and ecosystem panels
- Incident response center with operator controls
- Production monitoring default normalized to testnet

## What Was Missing

The repo exposes more monitorable state than the page was using. The highest-value gaps are the control plane and trust plane rather than another set of generic counters.

Confirmed repo-supported surfaces worth monitoring:

- `getFeeConfig`
- `getRentParams`
- `getMossStakePoolInfo`
- `getRewardAdjustmentInfo`
- `getIncidentStatus`
- `getSignedMetadataManifest`
- `getClusterInfo`
- `getValidators`
- `getNetworkInfo`
- `getProgramStats`
- `getProgramCalls`
- `getLichenOracleStats`
- `getLichenBridgeStats`
- `getShieldedPoolState`

## Shipped In This Pass

- Control-plane panel for fee policy, rent policy, MossStake pool state, incident mode, and signed metadata trust state
- Production testnet-default policy applied across Monitoring, Website, Explorer, Wallet, DEX, Marketplace, Programs, and Developers
- Monitoring registry list now fills the full panel height and only scrolls when content actually exceeds the card
- Recent Blocks and Live Event Feed no longer re-animate on every refresh

## Next Highest-Value Sections

### 1. Treasury And Distribution Board

Use:

- `getRewardAdjustmentInfo`

Show:

- Current balances for validator rewards, community treasury, builder grants, founding symbionts, ecosystem partners, and reserve pool
- Drift from genesis allocation
- Fast warnings when a monitored treasury wallet drops below configured thresholds

Reason:

The supply panel explains allocation, but it does not yet answer whether those buckets are being spent, drained, or rebalanced unexpectedly.

### 2. Network Infrastructure Board

Use:

- `getNetworkInfo`
- `getClusterInfo`
- `getValidators`
- `getVersion`

Show:

- Chain ID, network ID, genesis hash, node version, peer count, cluster membership, and validator liveness deltas

Reason:

Operators need one place to confirm version alignment and peer-health alignment during redeploys and upgrades.

### 3. Program Hotspots Board

Use:

- `getProgramStats`
- `getProgramCalls`

Show:

- Top contracts by call volume
- Recent call mix by program
- Hot contracts by error rate or unusual usage spikes

Reason:

This closes the gap between “the chain is healthy” and “which subsystems are actually absorbing load right now”.

### 4. Treasury And Governance Watch Surface

Use:

- `getIncidentStatus`
- governance watchtower outputs already described in deployment docs

Show:

- Current incident mode
- Most recent governance-sensitive alerts
- High-value wallet watch summaries

Reason:

The incident panel is action-oriented, but it still lacks an operator view of governance-watchtower outputs and live guarded-wallet status.

### 5. Privacy Pool Audit Board

Use:

- `getShieldedPoolState`

Show:

- Merkle root
- Commitment count
- Nullifier or pool-size growth
- Shielded pool balance share

Reason:

The ecosystem panel surfaces the shielded pool, but privacy infrastructure still deserves its own audit-oriented view.

### 6. Oracle And Bridge Deep Health

Use:

- `getLichenOracleStats`
- `getLichenBridgeStats`

Show:

- Feed count, query count, attestations, bridge validators, required confirms, locked amount, and pause state

Reason:

These are economic dependencies and should not remain buried as small values inside the ecosystem panel.

### 7. Service Fleet Board

Use:

- External and private health probes for faucet and custody
- Current deployment footprint knowledge: faucet on US/EU/SEA, custody on US

Show:

- Per-host health, last successful probe time, and which services are intentionally absent on a host

Reason:

Operators should not need SSH to answer whether faucet and custody are up on the intended footprint.

## Recommended Execution Order

1. Treasury and distribution board
2. Network infrastructure board
3. Program hotspots board
4. Oracle and bridge deep health
5. Service fleet board
6. Privacy pool audit board
7. Governance-watchtower integration

## Notes

- Keep production portals pinned to testnet defaults until mainnet is intentionally launched.
- Prefer TTL-based polling or WS-driven updates over full-card rerenders.
- Avoid presenting “operator controls” without equally visible “current policy and trust state” context.