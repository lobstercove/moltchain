// ═══════════════════════════════════════════════════════════════════════════════
// @lichen/dex-sdk — WebSocket Manager
// Real-time feeds: orderbook, trades, ticker, candles, user events
// ═══════════════════════════════════════════════════════════════════════════════

type Callback = (data: any) => void;

interface PendingSubscription {
  channel: string;
  callback: Callback;
}

/**
 * Manages WebSocket connection to LichenDEX server.
 * Handles auto-reconnect, subscription management, and message routing.
 */
export class DexWebSocket {
  private url: string;
  private apiKey?: string;
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Set<Callback>>();
  private subIdCounter = 0;
  private subIdMap = new Map<number, string>(); // subId → channel
  private channelSubId = new Map<string, number>(); // channel → subId
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private pending: PendingSubscription[] = [];
  private connected = false;

  constructor(url: string, apiKey?: string) {
    this.url = url;
    this.apiKey = apiKey;
    this.connect();
  }

  // -------------------------------------------------------------------------
  // Connection Management
  // -------------------------------------------------------------------------

  private connect(): void {
    try {
      const wsUrl = this.apiKey ? `${this.url}?api_key=${this.apiKey}` : this.url;

      // Use platform-appropriate WebSocket
      if (typeof globalThis.WebSocket !== 'undefined') {
        this.ws = new globalThis.WebSocket(wsUrl);
      } else {
        // Node.js environment — dynamic import
        const WS = require('ws');
        this.ws = new WS(wsUrl) as unknown as WebSocket;
      }

      this.ws!.onopen = () => {
        this.connected = true;
        this.reconnectDelay = 1000;

        // Re-subscribe all active channels
        for (const channel of this.subscriptions.keys()) {
          this.sendSubscribe(channel);
        }

        // Process pending subscriptions
        while (this.pending.length > 0) {
          const p = this.pending.shift()!;
          this.addCallback(p.channel, p.callback);
          this.sendSubscribe(p.channel);
        }
      };

      this.ws!.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
          this.handleMessage(msg);
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws!.onclose = () => {
        this.connected = false;
        this.scheduleReconnect();
      };

      this.ws!.onerror = () => {
        // onclose will fire after onerror
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  }

  private handleMessage(msg: any): void {
    // Subscription confirmation: { "type": "subscribed", "channel": "...", "subId": N }
    if (msg.type === 'subscribed' && msg.subId !== undefined) {
      this.subIdMap.set(msg.subId, msg.channel);
      this.channelSubId.set(msg.channel, msg.subId);
      return;
    }

    // Unsubscribed confirmation
    if (msg.type === 'unsubscribed') return;

    // Data message: { "channel": "trades:1", "data": {...} }
    const channel = msg.channel || (msg.subId !== undefined ? this.subIdMap.get(msg.subId) : undefined);
    if (!channel) return;

    const callbacks = this.subscriptions.get(channel);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(msg.data);
        } catch {
          // Don't let one bad callback kill others
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Subscription API
  // -------------------------------------------------------------------------

  /**
   * Subscribe to a channel. Returns an unsubscribe function.
   *
   * Channels:
   * - `orderbook:<pairId>` — L2 order book snapshots
   * - `trades:<pairId>` — Trade stream
   * - `ticker:<pairId>` — 1s price ticker
   * - `candles:<pairId>:<interval>` — Candle updates
   * - `orders:<traderAddr>` — User order updates
   * - `positions:<traderAddr>` — Margin position updates
   */
  subscribe(channel: string, callback: Callback): () => void {
    if (!this.connected) {
      this.pending.push({ channel, callback });
    } else {
      const isNew = this.addCallback(channel, callback);
      if (isNew) this.sendSubscribe(channel);
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(channel);
          this.sendUnsubscribe(channel);
        }
      }
    };
  }

  private addCallback(channel: string, callback: Callback): boolean {
    let callbacks = this.subscriptions.get(channel);
    const isNew = !callbacks;
    if (!callbacks) {
      callbacks = new Set();
      this.subscriptions.set(channel, callbacks);
    }
    callbacks.add(callback);
    return isNew;
  }

  private sendSubscribe(channel: string): void {
    if (!this.ws || !this.connected) return;
    const subId = ++this.subIdCounter;
    this.ws.send(JSON.stringify({
      method: 'subscribe',
      params: { channel },
      id: subId,
    }));
  }

  private sendUnsubscribe(channel: string): void {
    if (!this.ws || !this.connected) return;
    const subId = this.channelSubId.get(channel);
    this.ws.send(JSON.stringify({
      method: 'unsubscribe',
      params: { channel, subId },
      id: ++this.subIdCounter,
    }));
    if (subId !== undefined) {
      this.subIdMap.delete(subId);
      this.channelSubId.delete(channel);
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Close the WebSocket connection and stop reconnecting */
  close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.subscriptions.clear();
    this.subIdMap.clear();
    this.channelSubId.clear();
    this.pending = [];
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  /** Check if connected */
  isConnected(): boolean {
    return this.connected;
  }

  /** Get current subscription count */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}
