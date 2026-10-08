// Records docs/demo.mp4 by driving the site through a fixed script.
// Run: node tools/record_demo.mjs   (needs ffmpeg on the PATH)

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve, ROOT } from './serve.mjs';

const SIZE = { width: 1280, height: 720 };
const SNIPPET = [
  'public class Bath {',
  '  void fill() {',
  '    int ducks = 3',
  '    System.out.println(ducks);',
  '  }',
  '}',
].join('\n');

const server = await serve();
const dir = mkdtempSync(join(tmpdir(), 'duck-demo-'));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir, size: SIZE } });
const page = await context.newPage();
const pause = (ms) => page.waitForTimeout(ms);
const slide = async (id, value) => {
  await page.locator(id).scrollIntoViewIfNeeded();
  await page.locator(id).fill(String(value));
  await pause(450);
};

await page.goto(server.url);
await page.waitForSelector('#maker:not([hidden])');
await pause(1500);

// Choose a preset and rename it.
await page.click('#preset-row button:nth-child(2)');
await pause(700);
await page.fill('#duck-name', '');
await page.type('#duck-name', 'Edgar', { delay: 90 });
await pause(600);

// Recolour the body.
await page.locator('#palette input[type=color]').nth(1).evaluate((el) => {
  el.value = '#5b3fa6';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await pause(900);

// Set the personality: high sass, low chattiness.
await slide('#slider-sass', 95);
await slide('#slider-energy', 30);
await slide('#slider-chattiness', 10);
await slide('#slider-helpfulness', 100);
await page.check('#languages input[value="java"]');
await pause(900);

// Click the duck, then ask it about some code.
await page.click('#duck');
await pause(2200);
await page.click('#speech-close');
await page.dblclick('#duck');
await pause(1600);
await page.click('#speech-action');
await pause(500);
await page.type('#paste-text', SNIPPET, { delay: 14 });
await pause(900);
await page.click('#paste-ask');
await page.waitForSelector('#speech:not([hidden])');
await pause(4200);

const video = await page.video().path();
await context.close();
await browser.close();
server.close();

const out = join(ROOT, 'docs', 'demo.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-an', '-r', '30',
  '-vf', `scale=${SIZE.width}:${SIZE.height}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
rmSync(dir, { recursive: true, force: true });
console.log(`wrote ${out}`);
