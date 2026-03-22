// ═══════════════════════════════════════════════════════════════════════════════
// @moltchain/dex-sdk — Margin Module
// Margin positions, leverage, liquidation, insurance fund
// ═══════════════════════════════════════════════════════════════════════════════

import type { MarginPosition, PositionSide, PositionStatus } from './types';

const PRICE_SCALE = 1_000_000_000;
const PNL_BIAS = BigInt('9223372036854775808'); // 2^63

// Position Layout: 128 bytes (V2 — includes sl_price, tp_price, margin_mode)
// Bytes 0..32:   trader
// Bytes 32..40:  position_id
// Bytes 40..48:  pair_id
// Byte  48:      side (0=long, 1=short)
// Byte  49:      status (0=open, 1=closed, 2=liquidated)
// Bytes 50..58:  size
// Bytes 58..66:  margin
// Bytes 66..74:  entry_price
// Bytes 74..82:  leverage
// Bytes 82..90:  created_slot
// Bytes 90..98:  realized_pnl (biased u64, unbias with -2^63)
// Bytes 98..106: accumulated_funding
// Bytes 106..114: sl_price
// Bytes 114..122: tp_price
// Byte  122:      margin_mode (0=isolated, 1=cross)
const POSITION_SIZE = 128;

const SIDE_MAP: PositionSide[] = ['long', 'short'];
const STATUS_MAP: PositionStatus[] = ['open', 'closed', 'liquidated'];

/**
 * Decode a raw margin position blob (128 bytes V2) from contract storage.
 * Gracefully handles 112-byte V1 blobs by defaulting sl/tp/mode to zero.
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
    slPrice: buf.byteLength >= 114 ? view.getBigUint64(106, true) : 0n,
    tpPrice: buf.byteLength >= 122 ? view.getBigUint64(114, true) : 0n,
    marginMode: buf.byteLength >= 123 ? (buf[122] === 1 ? 'cross' : 'isolated') : 'isolated',
  };
}

/**
 * Encode open_position calldata.
 * Opcode: 0x02 = open_position (matches dex_margin contract dispatch)
 *
 * Layout: [opcode(1)] [trader(32)] [pair_id(8)] [side(1)] [size(8)] [leverage(8)] [margin(8)] [margin_mode(1)]
 * Total: 67 bytes
 */
export function encodeOpenPosition(
  trader: Uint8Array,
  pairId: number,
  side: PositionSide,
  size: bigint,
  leverage: number,
  margin: bigint,
  marginMode: 'isolated' | 'cross' = 'isolated',
): Uint8Array {
  const buf = new Uint8Array(67);
  const view = new DataView(buf.buffer);

  buf[0] = 0x02; // opcode 2: open_position
  buf.set(trader.slice(0, 32), 1);
  view.setBigUint64(33, BigInt(pairId), true);
  buf[41] = side === 'short' ? 1 : 0;
  view.setBigUint64(42, size, true);
  view.setBigUint64(50, BigInt(leverage), true);
  view.setBigUint64(58, margin, true);
  buf[66] = marginMode === 'cross' ? 1 : 0;

  return buf;
}

/**
 * Encode close_position calldata.
 * Opcode: 0x03 = close_position (matches dex_margin contract dispatch)
 *
 * Layout: [opcode(1)] [caller(32)] [position_id(8)]
 * Total: 41 bytes
 */
export function encodeClosePosition(caller: Uint8Array, positionId: number): Uint8Array {
  const buf = new Uint8Array(41);
  const view = new DataView(buf.buffer);

  buf[0] = 0x03; // opcode 3: close_position
  buf.set(caller.slice(0, 32), 1);
  view.setBigUint64(33, BigInt(positionId), true);

  return buf;
}

/**
 * Encode add_margin calldata.
 * Opcode: 0x04 = add_margin (matches dex_margin contract dispatch)
 *
 * Layout: [opcode(1)] [caller(32)] [position_id(8)] [amount(8)]
 * Total: 49 bytes
 */
export function encodeAddMargin(caller: Uint8Array, positionId: number, amount: bigint): Uint8Array {
  const buf = new Uint8Array(49);
  const view = new DataView(buf.buffer);

  buf[0] = 0x04; // opcode 4: add_margin
  buf.set(caller.slice(0, 32), 1);
  view.setBigUint64(33, BigInt(positionId), true);
  view.setBigUint64(41, amount, true);

  return buf;
}

/**
 * Encode remove_margin calldata.
 * Opcode: 0x05 = remove_margin
 *
 * Layout: [opcode(1)] [caller(32)] [position_id(8)] [amount(8)]
 * Total: 49 bytes
 */
export function encodeRemoveMargin(caller: Uint8Array, positionId: number, amount: bigint): Uint8Array {
  const buf = new Uint8Array(49);
  const view = new DataView(buf.buffer);

  buf[0] = 0x05;
  buf.set(caller.slice(0, 32), 1);
  view.setBigUint64(33, BigInt(positionId), true);
  view.setBigUint64(41, amount, true);

  return buf;
}

/**
 * Encode liquidate calldata.
 * Opcode: 0x06 = liquidate
 *
 * Layout: [opcode(1)] [liquidator(32)] [position_id(8)]
 * Total: 41 bytes
 */
export function encodeLiquidate(liquidator: Uint8Array, positionId: number): Uint8Array {
  const buf = new Uint8Array(41);
  const view = new DataView(buf.buffer);

  buf[0] = 0x06;
  buf.set(liquidator.slice(0, 32), 1);
  view.setBigUint64(33, BigInt(positionId), true);

  return buf;
}

/**
 * Encode set_position_sl_tp calldata.
 * Opcode: 24 = set_position_sl_tp
 *
 * Layout: [opcode(1)] [caller(32)] [position_id(8)] [sl_price(8)] [tp_price(8)]
 * Total: 57 bytes
 */
export function encodeSetSlTp(
  caller: Uint8Array,
  positionId: number,
  slPrice: bigint,
  tpPrice: bigint,
): Uint8Array {
  const buf = new Uint8Array(57);
  const view = new DataView(buf.buffer);

  buf[0] = 24;
  buf.set(caller.slice(0, 32), 1);
  view.setBigUint64(33, BigInt(positionId), true);
  view.setBigUint64(41, slPrice, true);
  view.setBigUint64(49, tpPrice, true);

  return buf;
}

/**
 * Encode partial_close calldata.
 * Opcode: 25 = partial_close
 *
 * Layout: [opcode(1)] [caller(32)] [position_id(8)] [close_amount(8)]
 * Total: 49 bytes
 */
export function encodePartialClose(caller: Uint8Array, positionId: number, closeAmount: bigint): Uint8Array {
  const buf = new Uint8Array(49);
  const view = new DataView(buf.buffer);

  buf[0] = 25;
  buf.set(caller.slice(0, 32), 1);
  view.setBigUint64(33, BigInt(positionId), true);
  view.setBigUint64(41, closeAmount, true);

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
