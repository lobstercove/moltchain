// ═══════════════════════════════════════════════════════════════════════════════
// Grid Market Making Strategy
// Places buy/sell orders at fixed price intervals in a range
// ═══════════════════════════════════════════════════════════════════════════════

import { LichenDEX } from '@lichen/dex-sdk';
import { GridConfig } from '../config';

interface GridLevel {
  price: number;
  orderId: number | null;
  side: 'buy' | 'sell';
  filled: boolean;
}

export class GridStrategy {
  private dex: LichenDEX;
  private pairId: number;
  private config: GridConfig;
  private dryRun: boolean;
  private levels: GridLevel[] = [];
  private running: boolean = false;
  private timer: NodeJS.Timer | null = null;
  private currentPrice: number = 0;

  constructor(
    dex: LichenDEX,
    pairId: number,
    config: GridConfig,
    dryRun: boolean = false,
  ) {
    this.dex = dex;
    this.pairId = pairId;
    this.config = config;
    this.dryRun = dryRun;
  }

  async start(): Promise<void> {
    this.running = true;
    console.log(`[Grid] Starting on pair ${this.pairId}`);
    console.log(`[Grid] Range: ${this.config.priceLow} — ${this.config.priceHigh}`);
    console.log(`[Grid] Levels: ${this.config.gridLevels}, Size: ${this.config.sizePerOrder}`);

    // Get current price
    await this.updateCurrentPrice();

    // Initialize grid levels
    this.initializeGrid();

    // Place initial orders
    await this.placeGridOrders();

    // Refresh loop
    this.timer = setInterval(() => this.tick(), this.config.refreshMs);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) clearInterval(this.timer as any);

    console.log(`[Grid] Stopping — cancelling all grid orders`);
    for (const level of this.levels) {
      if (level.orderId !== null) {
        try {
          await this.dex.cancelOrder({ orderId: level.orderId });
        } catch { /* already filled/cancelled */ }
      }
    }
    this.levels = [];
    console.log('[Grid] Stopped');
  }

  private initializeGrid(): void {
    const step = (this.config.priceHigh - this.config.priceLow) / this.config.gridLevels;
    this.levels = [];

    for (let i = 0; i <= this.config.gridLevels; i++) {
      const price = this.config.priceLow + i * step;
      // Below current price = buy orders, above = sell orders
      const side = price < this.currentPrice ? 'buy' : 'sell';

      this.levels.push({
        price,
        orderId: null,
        side,
        filled: false,
      });
    }

    console.log(`[Grid] Initialized ${this.levels.length} levels (${this.levels.filter(l => l.side === 'buy').length} buys, ${this.levels.filter(l => l.side === 'sell').length} sells)`);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;

    try {
      await this.updateCurrentPrice();

      // Check which orders have been filled
      for (const level of this.levels) {
        if (level.orderId === null) continue;

        try {
          const order = await this.dex.getOrder(level.orderId);
          if (order?.status === 'filled') {
            level.filled = true;
            level.orderId = null;

            // Flip side: if buy filled, place sell at next level up (and vice versa)
            const nextLevel = this.levels.find(l =>
              l.filled === false &&
              l.orderId === null &&
              (level.side === 'buy' ? l.price > level.price : l.price < level.price)
            );

            if (nextLevel) {
              const newSide = level.side === 'buy' ? 'sell' : 'buy';
              nextLevel.side = newSide;
              await this.placeOrder(nextLevel);
            }

            console.log(`[Grid] Level ${level.price.toFixed(6)} filled (${level.side}). Flipping.`);
          }
        } catch {
          // Order query failed, will retry next tick
        }
      }

      // Replace any missing orders
      for (const level of this.levels) {
        if (level.orderId === null && !level.filled) {
          await this.placeOrder(level);
        }
      }
    } catch (err: any) {
      console.error(`[Grid] Tick error: ${err.message}`);
    }
  }

  private async updateCurrentPrice(): Promise<void> {
    try {
      const ticker = await this.dex.getTicker(this.pairId);
      if (ticker?.lastPrice) {
        this.currentPrice = ticker.lastPrice;
      }
    } catch {
      // Keep existing
    }
  }

  private async placeGridOrders(): Promise<void> {
    let placed = 0;
    for (const level of this.levels) {
      if (await this.placeOrder(level)) placed++;
    }
    console.log(`[Grid] Placed ${placed} grid orders`);
  }

  private async placeOrder(level: GridLevel): Promise<boolean> {
    // Don't place orders too close to current price
    const distanceBps = Math.abs(level.price - this.currentPrice) / this.currentPrice * 10000;
    if (distanceBps < 5) return false; // Skip if <0.05% from current

    if (this.dryRun) {
      console.log(`[Grid][DRY] ${level.side.toUpperCase()} ${level.price.toFixed(6)} x ${this.config.sizePerOrder}`);
      return true;
    }

    try {
      const resp = await this.dex.placeLimitOrder({
        pair: this.pairId,
        side: level.side,
        price: level.price,
        quantity: this.config.sizePerOrder,
      });
      if (resp.data?.orderId) {
        level.orderId = resp.data.orderId;
        return true;
      }
    } catch (e: any) {
      console.error(`[Grid] Failed to place ${level.side} at ${level.price}: ${e.message}`);
    }
    return false;
  }
}
