# @moltchain/dex-sdk

TypeScript SDK for **MoltyDEX** — MoltChain's hybrid CLOB + concentrated liquidity AMM decentralized exchange.

## Installation

```bash
npm install @moltchain/dex-sdk @moltchain/sdk
```

## Quick Start

```typescript
import { MoltDEX } from '@moltchain/dex-sdk';
import { Keypair } from '@moltchain/sdk';

const wallet = Keypair.generate();
const dex = new MoltDEX({
  endpoint: 'https://dex.moltchain.io',
  wallet,
  moltyId: 'alice.molt',
});

// Place a limit buy order
const order = await dex.placeLimitOrder({
  pair: 'MOLT/mUSD',
  side: 'buy',
  price: 1.50,
  quantity: 1000,
});

// Smart-routed swap
const result = await dex.swap({
  tokenIn: 'MOLT',
  tokenOut: 'mUSD',
  amountIn: 1_000_000,
  slippage: 0.5,
});

// Real-time trade stream
const unsub = dex.subscribeTrades(1, (trade) => {
  console.log(`${trade.side} ${trade.quantity} @ ${trade.price}`);
});

// Clean up
unsub();
dex.disconnect();
```

## Modules

### Client — `MoltDEX`

Main SDK class with high-level methods for all DEX operations.

| Method | Description |
|--------|-------------|
| `getPairs()` | List all trading pairs |
| `getOrderBook(pairId, depth?)` | L2 order book |
| `getTrades(pairId, limit?)` | Recent trades |
| `placeLimitOrder(params)` | Place limit order |
| `placeMarketOrder(params)` | Place market order |
| `cancelOrder({ orderId })` | Cancel order |
| `cancelAllOrders(pairId?)` | Cancel all orders |
| `swap(params)` | Smart-routed swap |
| `getSwapQuote(params)` | Swap quote (no execution) |
| `getPools()` | List AMM pools |
| `addLiquidity(params)` | Add concentrated liquidity |
| `removeLiquidity(params)` | Remove liquidity |
| `openPosition(params)` | Open margin position |
| `closePosition(params)` | Close margin position |
| `getCandles(pairId, interval?, limit?)` | OHLCV candles |
| `getLeaderboard(limit?)` | Top traders |
| `getMyRewards()` | Pending rewards |
| `claimRewards()` | Claim rewards |
| `getProposals(status?)` | Governance proposals |
| `vote(proposalId, support, amount)` | Cast vote |

### WebSocket — `DexWebSocket`

Real-time market data feeds with auto-reconnect.

| Channel | Description |
|---------|-------------|
| `orderbook:<pairId>` | L2 order book snapshots |
| `trades:<pairId>` | Trade stream |
| `ticker:<pairId>` | 1s price ticker |
| `candles:<pairId>:<interval>` | Candle updates (60/300/900/3600/14400/86400) |
| `orders:<traderAddr>` | User order status updates |
| `positions:<traderAddr>` | Margin position updates |

### Orderbook Module

Low-level encoding/decoding for direct contract interaction.

```typescript
import { encodePlaceOrder, decodeOrder, buildOrderBook } from '@moltchain/dex-sdk';
```

### AMM Module

Pool math and liquidity calculations.

```typescript
import { priceToSqrtPrice, priceToTick, estimateSwapOutput } from '@moltchain/dex-sdk';
```

### Margin Module

PnL calculations and liquidation math.

```typescript
import { unrealizedPnl, liquidationPrice, isLiquidatable } from '@moltchain/dex-sdk';
```

### Router Module

Smart order routing utilities.

```typescript
import { suggestRouteType, calculatePriceImpact, calculateMinOutput } from '@moltchain/dex-sdk';
```

## Configuration

```typescript
const dex = new MoltDEX({
  endpoint: 'https://dex.moltchain.io',    // REST API
  wsEndpoint: 'wss://dex.moltchain.io/ws', // WebSocket
  wallet: myKeypair,                        // For signing transactions
  moltyId: 'alice.molt',                    // MoltyID identity
  apiKey: 'key_...',                        // Rate limit bypass
  timeout: 30000,                           // Request timeout (ms)
});
```

## Price Scaling

All on-chain prices are scaled by `1e9`. Use the static helpers:

```typescript
MoltDEX.priceToScaled(1.50);  // → 1_500_000_000n
MoltDEX.scaledToPrice(1_500_000_000n); // → 1.50
```

## License

MIT
