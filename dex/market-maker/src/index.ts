// ═══════════════════════════════════════════════════════════════════════════════
// MoltyDEX Market Maker Bot — Main Entry Point
// ═══════════════════════════════════════════════════════════════════════════════

import { MoltDEX, DexWebSocket } from '@moltchain/dex-sdk';
import { loadConfig, BotConfig } from './config';
import { SpreadStrategy } from './strategies/spread';
import { GridStrategy } from './strategies/grid';
import * as fs from 'fs';

function loadWallet(walletPath: string): any {
  if (!fs.existsSync(walletPath)) {
    console.error(`[Bot] Wallet keypair not found at ${walletPath}`);
    console.error('[Bot] Set MM_WALLET_PATH env var or create ./mm-keypair.json');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  // Support both [u8; 64] array and { secretKey, publicKey } formats
  const bytes = Array.isArray(raw) ? new Uint8Array(raw) : new Uint8Array(raw.secretKey || raw.secret_key);
  const pubkey = bytes.length >= 64 ? bytes.slice(32, 64) : bytes.slice(0, 32);
  return {
    pubkey: Buffer.from(pubkey).toString('hex'),
    sign: () => { throw new Error('Direct signing not implemented — use sendTransaction'); },
  };
}

function printBanner(config: BotConfig): void {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║          MoltyDEX Market Maker Bot             ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log(`  Endpoint:  ${config.endpoint}`);
  console.log(`  Pair:      ${config.pairId}`);
  console.log(`  Strategy:  ${config.strategy}`);
  console.log(`  Dry run:   ${config.dryRun}`);
  console.log(`  Log level: ${config.logLevel}`);
  console.log('');
}

async function main(): Promise<void> {
  const config = loadConfig();
  printBanner(config);

  const wallet = loadWallet(config.walletPath);
  console.log(`  Wallet:    ${wallet.pubkey.slice(0, 16)}...`);

  const dex = new MoltDEX({
    endpoint: config.endpoint,
    wsEndpoint: config.wsEndpoint,
    wallet,
  });

  const ws = new DexWebSocket(config.wsEndpoint);

  // Verify connectivity
  try {
    const pairs = await dex.getPairs();
    console.log(`[Bot] Connected. ${pairs.length || 0} pairs available.`);

    const pair = await dex.getPair(config.pairId);
    if (!pair) {
      console.error(`[Bot] Pair ${config.pairId} not found. Available pairs:`);
      pairs.forEach((p: any) => console.log(`  #${p.id}: ${p.baseName}/${p.quoteName}`));
      process.exit(1);
    }
    console.log(`[Bot] Trading pair #${pair.pairId}${pair.symbol ? ` (${pair.symbol})` : ''}`);
  } catch (err: any) {
    console.error(`[Bot] Failed to connect: ${err.message}`);
    process.exit(1);
  }

  // Start strategy
  let strategy: SpreadStrategy | GridStrategy;

  if (config.strategy === 'spread') {
    strategy = new SpreadStrategy(
      dex, ws, config.pairId,
      config.spread!,
      config.dryRun,
    );
  } else {
    strategy = new GridStrategy(
      dex, config.pairId,
      config.grid!,
      config.dryRun,
    );
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[Bot] Shutting down...');
    await strategy.stop();
    ws.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[Bot] Shutting down...');
    await strategy.stop();
    ws.close();
    process.exit(0);
  });

  await strategy.start();

  // Keep alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error('[Bot] Fatal error:', err);
  process.exit(1);
});
