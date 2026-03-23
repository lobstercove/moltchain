# Cross-Margin Account Design

> **Status**: Design only — not yet implemented. This document specifies the architecture for cross-margin trading on the Lichen DEX.

## Account Structure

A Cross-Margin Account pools collateral across all open positions, unlike Isolated Margin where each position has independent collateral.

### Position Record Extension

The existing position record is extended with a `margin_mode` field at **Byte 122**:
- `0x00` = Isolated Margin (default, current behavior)
- `0x01` = Cross-Margin

## New Opcodes

| Opcode | Name | Description |
|--------|------|-------------|
| `0x30` | `deposit_cross_margin` | Deposit collateral into cross-margin pool |
| `0x31` | `open_cross_position` | Open a position using shared cross-margin collateral |
| `0x32` | `close_cross_position` | Close a cross-margin position, return PnL to pool |
| `0x33` | `withdraw_cross_margin` | Withdraw excess collateral from pool |

## Leverage

- `MAX_LEVERAGE_CROSS` = `3` (conservative limit for shared-collateral risk)
- Isolated Margin retains `MAX_LEVERAGE` = `5`

## Isolated Margin vs Cross-Margin

| Feature | Isolated Margin | Cross-Margin |
|---------|----------------|--------------|
| Collateral | Per-position | Shared pool |
| Liquidation | Single position | Cascading possible |
| Max leverage | 5x | 3x |
| Risk | Contained | Portfolio-wide |

## Cascading Liquidation Risk

With cross-margin, a large loss on one position can deplete shared collateral, triggering Cascading Liquidation of other positions. Mitigations:
- Lower max leverage (3x vs 5x)
- Auto-deleverage threshold at 50% pool utilization
- Position-level stop-loss recommendations

## Frontend Mode Toggle

The margin type selector uses `data-mtype` attribute:
- `data-mtype="isolated"` — current default
- `data-mtype="cross"` — enables cross-margin UI

Mode Toggle switches between Isolated and Cross views in the trading panel.

## Migration

Existing isolated positions remain unchanged. Users opt-in to cross-margin per-account. Migration path:
1. User enables cross-margin mode
2. New positions opened in cross mode use shared pool
3. Existing isolated positions can be migrated individually
