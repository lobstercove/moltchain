// ═══════════════════════════════════════════════════════════════════════════════
// Spread Market Making Strategy
// Places symmetric bid/ask orders around a reference price
// ═══════════════════════════════════════════════════════════════════════════════

import { MoltDEX, DexWebSocket } from '@moltchain/dex-sdk';
import { SpreadConfig } from '../config';

interface ActiveOrder {
  orderId: number;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
}

export class SpreadStrategy {
  private dex: MoltDEX;
  private ws: DexWebSocket;
  private config: SpreadConfig;
  private pairId: number;
  private dryRun: boolean;
  private activeOrders: ActiveOrder[] = [];
  private referencePrice: number = 0;
  private netPosition: number = 0; // + = long, - = short
  private running: boolean = false;
  private timer: NodeJS.Timer | null = null;

  constructor(
    dex: MoltDEX,
    ws: DexWebSocket,
    pairId: number,
    config: SpreadConfig,
    dryRun: boolean = false,
  ) {
    this.dex = dex;
    this.ws = ws;
    this.pairId = pairId;
    this.config = config;
    this.dryRun = dryRun;
  }

  async start(): Promise<void> {
    this.running = true;
    console.log(`[Spread] Starting on pair ${this.pairId}`);
    console.log(`[Spread] Half-spread: ${this.config.halfSpreadBps}bps, Levels: ${this.config.levels}`);
    console.log(`[Spread] Size/level: ${this.config.sizePerLevel}, Refresh: ${this.config.refreshMs}ms`);

    // Get initial reference price
    await this.updateReferencePrice();

    // Subscribe to trades for live price updates
    this.ws.subscribe(`trades:${this.pairId}`, (event: any) => {
      if (event.data?.price) {
        this.referencePrice = parseFloat(event.data.price);
      }
    });

    // Subscribe to own order updates
    this.ws.subscribe(`orders:mm`, (event: any) => {
      if (event.data?.status === 'filled') {
        const filled = this.activeOrders.find(o => o.orderId === event.data.id);
        if (filled) {
          this.netPosition += filled.side === 'buy' ? filled.quantity : -filled.quantity;
          console.log(`[Spread] Order ${filled.orderId} filled. Net position: ${this.netPosition}`);
        }
      }
    });

    // Main loop
    this.timer = setInterval(() => this.tick(), this.config.refreshMs);
    await this.tick();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) clearInterval(this.timer as any);

    // Cancel all active orders
    console.log(`[Spread] Stopping — cancelling ${this.activeOrders.length} orders`);
    await this.cancelAllOrders();
    console.log('[Spread] Stopped');
  }

  private async tick(): Promise<void> {
    if (!this.running) return;

    try {
      // Update reference price
      await this.updateReferencePrice();
      if (this.referencePrice <= 0) {
        console.log('[Spread] No reference price available, skipping tick');
        return;
      }

      // Cancel stale orders
      await this.cancelAllOrders();

      // Calculate skew adjustment
      const skewAdj = this.calculateSkewAdjustment();

      // Place new orders
      await this.placeOrders(skewAdj);
    } catch (err: any) {
      console.error(`[Spread] Tick error: ${err.message}`);
    }
  }

  private async updateReferencePrice(): Promise<void> {
    try {
      const ticker = await this.dex.getTicker(this.pairId);
      if (ticker?.lastPrice) {
        this.referencePrice = ticker.lastPrice;
      }
    } catch {
      // Keep existing reference price
    }
  }

  private calculateSkewAdjustment(): number {
    // Shift quotes away from accumulated position
    // If long, make asks cheaper (encourage selling)
    // If short, make bids higher (encourage buying)
    const skewRatio = Math.abs(this.netPosition) / this.config.maxSkew;
    const clampedRatio = Math.min(skewRatio, 1.0);
    const adjBps = clampedRatio * this.config.halfSpreadBps * 0.5;
    return this.netPosition > 0 ? -adjBps : adjBps; // negative = shift down
  }

  private async placeOrders(skewAdjBps: number): Promise<void> {
    const orders: ActiveOrder[] = [];

    for (let i = 0; i < this.config.levels; i++) {
      const levelOffset = i * this.config.levelStepBps;

      // Bid
      const bidBps = this.config.halfSpreadBps + levelOffset + skewAdjBps;
      const bidPrice = this.referencePrice * (1 - bidBps / 10000);

      // Ask
      const askBps = this.config.halfSpreadBps + levelOffset - skewAdjBps;
      const askPrice = this.referencePrice * (1 + askBps / 10000);

      if (this.dryRun) {
        console.log(`[Spread][DRY] BID ${bidPrice.toFixed(6)} x ${this.config.sizePerLevel} | ASK ${askPrice.toFixed(6)} x ${this.config.sizePerLevel}`);
        continue;
      }

      try {
        const bidResp = await this.dex.placeLimitOrder({
          pair: this.pairId,
          side: 'buy',
          price: bidPrice,
          quantity: this.config.sizePerLevel,
        });
        if (bidResp.data?.orderId) {
          orders.push({ orderId: bidResp.data.orderId, side: 'buy', price: bidPrice, quantity: this.config.sizePerLevel });
        }
      } catch (e: any) {
        console.error(`[Spread] Failed to place bid: ${e.message}`);
      }

      try {
        const askResp = await this.dex.placeLimitOrder({
          pair: this.pairId,
          side: 'sell',
          price: askPrice,
          quantity: this.config.sizePerLevel,
        });
        if (askResp.data?.orderId) {
          orders.push({ orderId: askResp.data.orderId, side: 'sell', price: askPrice, quantity: this.config.sizePerLevel });
        }
      } catch (e: any) {
        console.error(`[Spread] Failed to place ask: ${e.message}`);
      }
    }

    this.activeOrders = orders;
    if (!this.dryRun) {
      console.log(`[Spread] Placed ${orders.length} orders around ${this.referencePrice.toFixed(6)} (skew: ${this.netPosition})`);
    }
  }

  private async cancelAllOrders(): Promise<void> {
    for (const order of this.activeOrders) {
      try {
        await this.dex.cancelOrder({ orderId: order.orderId });
      } catch {
        // Order may already be filled or cancelled
      }
    }
    this.activeOrders = [];
  }
}
