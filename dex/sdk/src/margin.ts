// ═══════════════════════════════════════════════════════════════════════════════
// @moltchain/dex-sdk — Margin Module
// Margin positions, leverage, liquidation, insurance fund
// ═══════════════════════════════════════════════════════════════════════════════

import type { MarginPosition, PositionSide, PositionStatus } from './types';

const PRICE_SCALE = 1_000_000_000;
const PNL_BIAS = BigInt('9223372036854775808'); // 2^63

// Position Layout: 112 bytes
const POSITION_SIZE = 112;

const SIDE_MAP: PositionSide[] = ['long', 'short'];
const STATUS_MAP: PositionStatus[] = ['open', 'closed', 'liquidated'];

/**
 * Decode a raw 112-byte margin position blob from contract storage
 */
export function decodeMarginPosition(buf: Uint8Array): MarginPosition {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  const rawPnl = view.getBigUint64(90, true);
  // Unbias: actual PnL = rawPnl - 2^63
  const realizedPnl = rawPnl - PNL_BIAS;

  return {
    trader: Buffer.from(buf.slice(0, 32)).toString('hex'),
    positionId: Number(view.getBigUint64(32, true)),
    pairId: Number(view.getBigUint64(40, true)),
    side: SIDE_MAP[buf[48]] || 'long',
    status: STATUS_MAP[buf[49]] || 'open',
    size: view.getBigUint64(50, true),
    margin: view.getBigUint64(58, true),
    entryPrice: view.getBigUint64(66, true),
    leverage: Number(view.getBigUint64(74, true)),
    createdSlot: Number(view.getBigUint64(82, true)),
    realizedPnl,
    accumulatedFunding: view.getBigUint64(98, true),
  };
}

/**
 * Encode open_position calldata.
 * Opcode: 0x01 = open_position
 *
 * Layout: [opcode(1)] [pair_id(8)] [side(1)] [margin(8)] [leverage(8)]
 */
export function encodeOpenPosition(
  pairId: number,
  side: PositionSide,
  margin: bigint,
  leverage: number,
): Uint8Array {
  const buf = new Uint8Array(26);
  const view = new DataView(buf.buffer);

  buf[0] = 0x01;
  view.setBigUint64(1, BigInt(pairId), true);
  buf[9] = side === 'short' ? 1 : 0;
  view.setBigUint64(10, margin, true);
  view.setBigUint64(18, BigInt(leverage), true);

  return buf;
}

/**
 * Encode close_position calldata.
 * Opcode: 0x02 = close_position
 *
 * Layout: [opcode(1)] [position_id(8)]
 */
export function encodeClosePosition(positionId: number): Uint8Array {
  const buf = new Uint8Array(9);
  const view = new DataView(buf.buffer);

  buf[0] = 0x02;
  view.setBigUint64(1, BigInt(positionId), true);

  return buf;
}

/**
 * Encode add_margin calldata.
 * Opcode: 0x03 = add_margin
 *
 * Layout: [opcode(1)] [position_id(8)] [amount(8)]
 */
export function encodeAddMargin(positionId: number, amount: bigint): Uint8Array {
  const buf = new Uint8Array(17);
  const view = new DataView(buf.buffer);

  buf[0] = 0x03;
  view.setBigUint64(1, BigInt(positionId), true);
  view.setBigUint64(9, amount, true);

  return buf;
}

// ---------------------------------------------------------------------------
// PnL & Margin Calculations
// ---------------------------------------------------------------------------

/**
 * Calculate unrealized PnL for a margin position.
 *
 * For LONG:  PnL = (markPrice - entryPrice) * size / 1e9
 * For SHORT: PnL = (entryPrice - markPrice) * size / 1e9
 */
export function unrealizedPnl(
  side: PositionSide,
  entryPrice: bigint,
  markPrice: bigint,
  size: bigint,
): bigint {
  if (side === 'long') {
    return (markPrice - entryPrice) * size / BigInt(PRICE_SCALE);
  } else {
    return (entryPrice - markPrice) * size / BigInt(PRICE_SCALE);
  }
}

/**
 * Calculate margin ratio: margin / (notional value).
 * If ratio drops below maintenance margin (1000 bps = 10%), position is liquidatable.
 */
export function marginRatio(
  margin: bigint,
  markPrice: bigint,
  size: bigint,
): number {
  const notional = markPrice * size / BigInt(PRICE_SCALE);
  if (notional === 0n) return 1;
  return Number(margin * 10000n / notional);
}

/**
 * Check if a position is liquidatable.
 * Default maintenance margin = 1000 bps (10%)
 */
export function isLiquidatable(
  side: PositionSide,
  entryPrice: bigint,
  margin: bigint,
  markPrice: bigint,
  size: bigint,
  maintenanceBps: number = 1000,
): boolean {
  const pnl = unrealizedPnl(side, entryPrice, markPrice, size);
  const effectiveMargin = BigInt(Number(margin)) + pnl; // margin + unrealized PnL
  if (effectiveMargin <= 0n) return true;

  const notional = markPrice * size / BigInt(PRICE_SCALE);
  if (notional === 0n) return false;

  const ratio = Number(effectiveMargin * 10000n / notional);
  return ratio < maintenanceBps;
}

/**
 * Calculate liquidation price for a position.
 *
 * For LONG:  liqPrice = entryPrice - (margin * 1e9 / size) * (1 - maint%)
 * For SHORT: liqPrice = entryPrice + (margin * 1e9 / size) * (1 - maint%)
 */
export function liquidationPrice(
  side: PositionSide,
  entryPrice: bigint,
  margin: bigint,
  size: bigint,
  maintenanceBps: number = 1000,
): bigint {
  if (size === 0n) return 0n;

  const marginPerUnit = margin * BigInt(PRICE_SCALE) / size;
  const maintFraction = marginPerUnit * BigInt(maintenanceBps) / 10000n;
  const buffer = marginPerUnit - maintFraction;

  if (side === 'long') {
    const liq = entryPrice - buffer;
    return liq < 0n ? 0n : liq;
  } else {
    return entryPrice + buffer;
  }
}

/**
 * Calculate effective leverage: notional / margin
 */
export function effectiveLeverage(
  markPrice: bigint,
  size: bigint,
  margin: bigint,
): number {
  if (margin === 0n) return Infinity;
  const notional = markPrice * size / BigInt(PRICE_SCALE);
  return Number(notional) / Number(margin);
}
