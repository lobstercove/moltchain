// ═══════════════════════════════════════════════════════════════════════════════
// @moltchain/dex-sdk — AMM Module
// Pool creation, concentrated liquidity management, direct pool swaps
// ═══════════════════════════════════════════════════════════════════════════════

import type { Pool, LPPosition, FeeTier } from './types';

const PRICE_SCALE = 1_000_000_000;

// Pool Layout: 96 bytes
const POOL_SIZE = 96;

// LP Position Layout: 80 bytes
const POSITION_SIZE = 80;

// Fee tier map
const FEE_TIER_MAP: FeeTier[] = ['1bps', '5bps', '30bps', '100bps'];
const FEE_TIER_BPS: Record<FeeTier, number> = { '1bps': 1, '5bps': 5, '30bps': 30, '100bps': 100 };

/**
 * Decode a raw 96-byte pool blob from contract storage
 */
export function decodePool(buf: Uint8Array): Pool {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  return {
    tokenA: Buffer.from(buf.slice(0, 32)).toString('hex'),
    tokenB: Buffer.from(buf.slice(32, 64)).toString('hex'),
    poolId: Number(view.getBigUint64(64, true)),
    sqrtPrice: view.getBigUint64(72, true),
    tick: view.getInt32(80, true),
    liquidity: view.getBigUint64(84, true),
    feeTier: FEE_TIER_MAP[buf[92]] || '30bps',
    protocolFee: buf[93],
  };
}

/**
 * Decode a raw 80-byte LP position blob from contract storage
 */
export function decodeLPPosition(buf: Uint8Array): LPPosition {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  return {
    owner: Buffer.from(buf.slice(0, 32)).toString('hex'),
    poolId: Number(view.getBigUint64(32, true)),
    lowerTick: view.getInt32(40, true),
    upperTick: view.getInt32(44, true),
    liquidity: view.getBigUint64(48, true),
    feeAOwed: view.getBigUint64(56, true),
    feeBOwed: view.getBigUint64(64, true),
    createdSlot: Number(view.getBigUint64(72, true)),
    positionId: 0, // Set externally from key
  };
}

/**
 * Encode create_pool calldata.
 * Opcode: 0x01 = create_pool
 *
 * Layout: [opcode(1)] [token_a(32)] [token_b(32)] [sqrt_price(8)] [fee_tier(1)]
 */
export function encodeCreatePool(
  tokenA: Uint8Array,
  tokenB: Uint8Array,
  sqrtPrice: bigint,
  feeTier: number,
): Uint8Array {
  const buf = new Uint8Array(74);
  const view = new DataView(buf.buffer);

  buf[0] = 0x01;
  buf.set(tokenA, 1);
  buf.set(tokenB, 33);
  view.setBigUint64(65, sqrtPrice, true);
  buf[73] = feeTier;

  return buf;
}

/**
 * Encode add_liquidity calldata.
 * Opcode: 0x03 = add_liquidity
 *
 * Layout: [opcode(1)] [provider(32)] [pool_id(8)] [lower_tick(4)] [upper_tick(4)] [amount_a(8)] [amount_b(8)]
 */
export function encodeAddLiquidity(
  provider: Uint8Array,
  poolId: number,
  lowerTick: number,
  upperTick: number,
  amountA: bigint,
  amountB: bigint,
): Uint8Array {
  const buf = new Uint8Array(65);
  const view = new DataView(buf.buffer);

  buf[0] = 0x03;
  buf.set(provider.subarray(0, 32), 1);
  view.setBigUint64(33, BigInt(poolId), true);
  view.setInt32(41, lowerTick, true);
  view.setInt32(45, upperTick, true);
  view.setBigUint64(49, amountA, true);
  view.setBigUint64(57, amountB, true);

  return buf;
}

/**
 * Encode remove_liquidity calldata.
 * Opcode: 0x04 = remove_liquidity
 *
 * Layout: [opcode(1)] [provider(32)] [position_id(8)] [liquidity_amount(8)]
 */
export function encodeRemoveLiquidity(provider: Uint8Array, positionId: number, liquidityAmount: bigint): Uint8Array {
  const buf = new Uint8Array(49);
  const view = new DataView(buf.buffer);

  buf[0] = 0x04;
  buf.set(provider.subarray(0, 32), 1);
  view.setBigUint64(33, BigInt(positionId), true);
  view.setBigUint64(41, liquidityAmount, true);

  return buf;
}

/**
 * Encode swap calldata.
 * Opcode: 0x05 = swap
 *
 * Layout: [opcode(1)] [pool_id(8)] [amount_in(8)] [zero_for_one(1)] [min_out(8)]
 */
export function encodeSwap(
  poolId: number,
  amountIn: bigint,
  zeroForOne: boolean,
  minOut: bigint,
): Uint8Array {
  const buf = new Uint8Array(26);
  const view = new DataView(buf.buffer);

  buf[0] = 0x05;
  view.setBigUint64(1, BigInt(poolId), true);
  view.setBigUint64(9, amountIn, true);
  buf[17] = zeroForOne ? 1 : 0;
  view.setBigUint64(18, minOut, true);

  return buf;
}

// ---------------------------------------------------------------------------
// Math Utilities
// ---------------------------------------------------------------------------

/**
 * Convert a price to a sqrt_price in Q32.32 fixed-point format.
 * sqrt_price = sqrt(price) * 2^32
 */
export function priceToSqrtPrice(price: number): bigint {
  return BigInt(Math.round(Math.sqrt(price) * (2 ** 32)));
}

/**
 * Convert a sqrt_price (Q32.32) back to a human-readable price.
 */
export function sqrtPriceToPrice(sqrtPrice: bigint): number {
  const sp = Number(sqrtPrice) / (2 ** 32);
  return sp * sp;
}

/**
 * Convert a price to the nearest tick index.
 * Uses log base 1.0001 (same as Uniswap V3 convention).
 */
export function priceToTick(price: number): number {
  return Math.round(Math.log(price) / Math.log(1.0001));
}

/**
 * Convert a tick index back to a price.
 */
export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

/**
 * Get the fee in basis points for a fee tier.
 */
export function feeTierBps(tier: FeeTier): number {
  return FEE_TIER_BPS[tier] || 30;
}

/**
 * Calculate the expected output for a swap (simplified constant-product formula).
 * For concentrated liquidity the actual output depends on tick ranges.
 */
export function estimateSwapOutput(
  amountIn: number,
  liquidity: number,
  sqrtPrice: number,
  zeroForOne: boolean,
  feeBps: number,
): number {
  const fee = amountIn * (feeBps / 10000);
  const netIn = amountIn - fee;

  if (zeroForOne) {
    // Token A → Token B: output ≈ netIn * (sqrtPrice^2)
    return netIn * (sqrtPrice * sqrtPrice);
  } else {
    // Token B → Token A: output ≈ netIn / (sqrtPrice^2)
    if (sqrtPrice === 0) return 0;
    return netIn / (sqrtPrice * sqrtPrice);
  }
}
