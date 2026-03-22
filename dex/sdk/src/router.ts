// ═══════════════════════════════════════════════════════════════════════════════
// @moltchain/dex-sdk — Router Module
// Smart order routing: CLOB → AMM → Split → Multi-hop
// ═══════════════════════════════════════════════════════════════════════════════

import type { Route, RouteType, SwapResult } from './types';

const ROUTE_SIZE = 96;
const ROUTE_TYPE_MAP: RouteType[] = ['clob', 'amm', 'split', 'multi_hop', 'legacy'];

/**
 * Decode a raw 96-byte route blob from contract storage
 */
export function decodeRoute(buf: Uint8Array): Route {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  return {
    tokenIn: Buffer.from(buf.slice(0, 32)).toString('hex'),
    tokenOut: Buffer.from(buf.slice(32, 64)).toString('hex'),
    routeId: Number(view.getBigUint64(64, true)),
    routeType: ROUTE_TYPE_MAP[buf[72]] || 'clob',
    poolOrPairId: Number(view.getBigUint64(73, true)),
    secondaryId: Number(view.getBigUint64(81, true)),
    splitPercent: buf[89],
    enabled: buf[90] === 1,
  };
}

/**
 * Encode a router swap calldata.
 * Opcode: 0x03 = execute_swap
 *
 * Layout: [opcode(1)] [token_in(32)] [token_out(32)] [amount_in(8)] [min_out(8)]
 */
export function encodeRouterSwap(
  tokenIn: Uint8Array,
  tokenOut: Uint8Array,
  amountIn: bigint,
  minOut: bigint,
): Uint8Array {
  const buf = new Uint8Array(81);
  const view = new DataView(buf.buffer);

  buf[0] = 0x03;
  buf.set(tokenIn, 1);
  buf.set(tokenOut, 33);
  view.setBigUint64(65, amountIn, true);
  view.setBigUint64(73, minOut, true);

  return buf;
}

/**
 * Decode a raw 72-byte swap record blob from contract storage
 */
export function decodeSwapRecord(buf: Uint8Array): SwapResult {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  return {
    amountIn: view.getBigUint64(32, true),
    amountOut: view.getBigUint64(40, true),
    routeType: ROUTE_TYPE_MAP[buf[48]] || 'clob',
    slot: Number(view.getBigUint64(49, true)),
    routeId: Number(view.getBigUint64(57, true)),
    priceImpact: 0, // Computed by caller
  };
}

/**
 * Calculate minimum output given slippage tolerance.
 * @param expectedOutput - Expected output amount
 * @param slippagePercent - Slippage tolerance (e.g. 0.5 = 0.5%)
 */
export function calculateMinOutput(expectedOutput: number, slippagePercent: number): number {
  return Math.floor(expectedOutput * (1 - slippagePercent / 100));
}

/**
 * Calculate price impact given input and output amounts.
 * priceImpact = 1 - (actualRate / expectedRate)
 */
export function calculatePriceImpact(
  amountIn: number,
  amountOut: number,
  spotPrice: number,
): number {
  if (amountIn === 0 || spotPrice === 0) return 0;
  const expectedOut = amountIn * spotPrice;
  return Math.abs(1 - amountOut / expectedOut) * 100;
}

/**
 * Determine optimal route type based on order size relative to book depth.
 * - Small orders → CLOB (better prices at top of book)
 * - Large orders → Split CLOB/AMM (less slippage)
 * - No CLOB liquidity → AMM only
 */
export function suggestRouteType(
  amountIn: number,
  clobDepth: number,
  ammLiquidity: number,
): RouteType {
  if (clobDepth === 0 && ammLiquidity === 0) return 'clob'; // Will fail, but CLOB is default
  if (clobDepth === 0) return 'amm';
  if (ammLiquidity === 0) return 'clob';

  // If order is <50% of CLOB depth, use CLOB
  if (amountIn < clobDepth * 0.5) return 'clob';

  // If order is 50-200% of CLOB depth, split
  if (amountIn < clobDepth * 2) return 'split';

  // Very large orders → AMM (more consistent pricing)
  return 'amm';
}
