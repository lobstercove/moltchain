const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:3011/playground.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#programsPlaygroundFrame', { timeout: 15000 });

  const frame = page.frameLocator('#programsPlaygroundFrame');
  await frame.locator('#networkSelect').selectOption('local-testnet');

  await frame.locator('#terminalInput').evaluate((input) => {
    input.value = 'rpc getSlot';
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
    }));
  });

  const outputLine = frame.locator('#terminalLines .terminal-line').filter({ hasText: /\b\d+\b/ }).last();
  await outputLine.waitFor({ timeout: 15000 });
  const text = (await outputLine.innerText()).trim();

  const slotMatch = text.match(/\b(\d+)\b/);
  if (!slotMatch) {
    console.log('FAIL: no numeric slot found in terminal output');
    await browser.close();
    process.exit(1);
  }

  console.log(`PASS: playground rpc getSlot returned slot ${slotMatch[1]}`);
  await browser.close();
})();
