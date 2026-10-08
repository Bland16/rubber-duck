// Renders assets/og.png, the static link-preview image. Run: node tools/make_og.mjs

import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve, ROOT } from './serve.mjs';

const server = await serve();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 627 }, deviceScaleFactor: 1 });
  await page.goto(`${server.url}tools/og.html`);
  await page.waitForSelector('body[data-ready="true"]');
  const out = join(ROOT, 'assets', 'og.png');
  await page.locator('#og').screenshot({ path: out });
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
  server.close();
}
