// A browser check of the "Take your duck home" block in the Export panel.
// Not part of `npm test` (it needs Playwright's browser). Run by hand:
//   node tests/desktop-page.check.mjs

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve, ROOT } from '../tools/serve.mjs';

const server = await serve();
const browser = await chromium.launch();
const failures = [];
const need = (condition, what) => { if (!condition) failures.push(what); };

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(server.url);
  await page.waitForSelector('#maker:not([hidden])');
  const block = page.locator('#export-panel details.take-home, section details.take-home').first();
  need(await block.count() === 1, 'the block is in the page');
  need(await block.evaluate((el) => Boolean(el.closest('section')?.querySelector('#export-file'))), 'it sits in the Export panel');
  need(await block.evaluate((el) => !el.open), 'it is closed by default');
  need((await block.locator('summary').textContent()).trim() === 'Take your duck home (Windows)', 'the summary text');
  await block.locator('summary').click();
  need(await block.evaluate((el) => el.open), 'it opens');
  need(await block.locator('ol > li').count() === 5, 'it lists five steps');
  const link = block.locator('a[download]');
  need(await link.getAttribute('href') === 'desktop/build-a-duck.pyzw', 'the download link points at the built file');
  const fetched = await page.evaluate(async (href) => {
    const response = await fetch(href);
    return { ok: response.ok, bytes: Array.from(new Uint8Array(await response.arrayBuffer())) };
  }, await link.getAttribute('href'));
  const onDisk = readFileSync(join(ROOT, 'desktop', 'build-a-duck.pyzw'));
  need(fetched.ok && Buffer.from(fetched.bytes).equals(onDisk), 'the link serves the built file byte for byte');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  need(!overflow, 'no sideways scroll with the block open');

  const phone = await browser.newPage({ viewport: { width: 375, height: 700 } });
  await phone.goto(server.url);
  await phone.waitForSelector('#viewer:not([hidden])');
  need(!(await phone.locator('details.take-home').isVisible()), 'it is not shown in view-only mode');
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(`FAILED:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('ok: the "Take your duck home" block');
