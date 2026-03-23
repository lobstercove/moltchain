// ═══════════════════════════════════════════════════════════════════════════════
// @lichen/dex-sdk — Orderbook Module
// Direct contract interaction for order placement, cancellation, book queries
// ═══════════════════════════════════════════════════════════════════════════════

import type { Order, OrderBook, OrderBookLevel, PlaceOrderParams, Side, OrderType, OrderStatus } from './types';

const PRICE_SCALE = 1_000_000_000;

// Order Layout: 128 bytes (matches dex_core storage exactly)
const ORDER_SIZE = 128;

// Order status byte → string map
const ORDER_STATUS_MAP: OrderStatus[] = ['open', 'partial', 'filled', 'cancelled', 'expired'];
const SIDE_MAP: Side[] = ['buy', 'sell'];
const TYPE_MAP: OrderType[] = ['limit', 'market', 'stop-limit', 'post-only'];

/**
 * Decode a raw 128-byte order blob from contract storage
 */
export function decodeOrder(buf: Uint8Array): Order {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  const trader = Buffer.from(buf.slice(0, 32)).toString('hex');
  const pairId = Number(view.getBigUint64(32, true));
  const side = SIDE_MAP[buf[40]] || 'buy';
  const orderType = TYPE_MAP[buf[41]] || 'limit';
  const price = view.getBigUint64(42, true);
  const quantity = view.getBigUint64(50, true);
  const filled = view.getBigUint64(58, true);
  const status = ORDER_STATUS_MAP[buf[66]] || 'open';
  const createdSlot = Number(view.getBigUint64(67, true));
  const expirySlot = Number(view.getBigUint64(75, true));
  const orderId = Number(view.getBigUint64(83, true));

  return {
    orderId,
    trader,
    pairId,
    side,
    orderType,
    price,
    quantity,
    filled,
    status,
    createdSlot,
    expirySlot,
  };
}

/**
 * Encode PlaceOrderParams into contract calldata.
 * Opcode: 0x02 = place_order
 *
 * Layout: [opcode(1)] [trader(32)] [pair_id(8)] [side(1)] [type(1)] [price(8)] [qty(8)] [expiry(8)]
 */
export function encodePlaceOrder(params: PlaceOrderParams, trader: Uint8Array): Uint8Array {
  const buf = new Uint8Array(67);
  const view = new DataView(buf.buffer);

  buf[0] = 0x02; // place_order opcode
  buf.set(trader.subarray(0, 32), 1);
  const pairId = typeof params.pair === 'number' ? params.pair : 0; // resolve symbol to pairId externally
  view.setBigUint64(33, BigInt(pairId), true);
  buf[41] = params.side === 'sell' ? 1 : 0;
  buf[42] = params.orderType === 'market' ? 1 : params.orderType === 'stop-limit' ? 2 : params.orderType === 'post-only' ? 3 : 0;
  view.setBigUint64(43, BigInt(Math.round(params.price * PRICE_SCALE)), true);
  view.setBigUint64(51, BigInt(params.quantity), true);
  view.setBigUint64(59, BigInt(params.expiry || 0), true);

  return buf;
}

/**
 * Encode cancel order calldata.
 * Opcode: 0x03 = cancel_order
 *
 * Layout: [opcode(1)] [trader(32)] [order_id(8)]
 */
export function encodeCancelOrder(trader: Uint8Array, orderId: number): Uint8Array {
  const buf = new Uint8Array(41);
  const view = new DataView(buf.buffer);

  buf[0] = 0x03; // cancel_order opcode
  buf.set(trader.subarray(0, 32), 1);
  view.setBigUint64(33, BigInt(orderId), true);

  return buf;
}

/**
 * Build a local order book from bid/ask levels.
 * Used to aggregate raw price level data from contract storage.
 */
export function buildOrderBook(
  pairId: number,
  bids: Map<number, number>,
  asks: Map<number, number>,
  depth: number = 20,
): OrderBook {
  const sortedBids: OrderBookLevel[] = Array.from(bids.entries())
    .sort((a, b) => b[0] - a[0])
    .slice(0, depth)
    .map(([price, qty]) => ({
      price: price / PRICE_SCALE,
      quantity: qty,
      orders: 1,
    }));

  const sortedAsks: OrderBookLevel[] = Array.from(asks.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(0, depth)
    .map(([price, qty]) => ({
      price: price / PRICE_SCALE,
      quantity: qty,
      orders: 1,
    }));

  return {
    pairId,
    bids: sortedBids,
    asks: sortedAsks,
    lastUpdate: Date.now(),
  };
}

/**
 * Calculate mid price from an order book
 */
export function midPrice(book: OrderBook): number | null {
  if (book.bids.length === 0 || book.asks.length === 0) return null;
  return (book.bids[0].price + book.asks[0].price) / 2;
}

/**
 * Calculate spread in basis points
 */
export function spreadBps(book: OrderBook): number | null {
  if (book.bids.length === 0 || book.asks.length === 0) return null;
  const mid = midPrice(book);
  if (!mid || mid === 0) return null;
  return ((book.asks[0].price - book.bids[0].price) / mid) * 10_000;
}
