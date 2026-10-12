// Records docs/demo.mp4 by driving the site through a fixed script.
// Run: node tools/record_demo.mjs   (needs ffmpeg on the PATH)
//
// The duck's lines are normally picked at random. For the recording the pool is
// narrowed so the same lines come up every time; every line shown is one the
// site really has.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve, ROOT } from './serve.mjs';

const SIZE = { width: 1280, height: 720 };
const SNIPPET = [
  'public class GradeBook {',
  '    public double average(int[] scores) {',
  '        int total = 0;',
  '        for (int score : scores) {',
  '            total = total + score',
  '        }',
  '        return (double) total / scores.length;',
  '    }',
  '}',
].join('\n');

// A Senior Engineer with some sass: these are its keys.
const CHATTER = [
  'Someone threw me a whole baguette once. Poor planning on their part. Great day for me.',
  'A real duck asked what I do all day. I said consulting.',
];
const HUNCH = 'Line {line} looks like it is missing a semicolon. I have aged a year for each one of these.';
const CHOSEN = {
  'chatter.senior.spicy.general': CHATTER,
  'chatter.senior.spicy.code': CHATTER,
  'hunch.senior.semicolon.spicy.line': [HUNCH],
};

const server = await serve();
const dir = mkdtempSync(join(tmpdir(), 'duck-demo-'));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir, size: SIZE } });
const page = await context.newPage();
const pause = (ms) => page.waitForTimeout(ms);

// Serve the response pool with the chosen keys narrowed; the rest is untouched.
await page.route('**/js/responses.js', (route) => route.fulfill({
  contentType: 'text/javascript; charset=utf-8',
  body: `import pool from './responses.js?original';
const chosen = ${JSON.stringify(CHOSEN)};
const real = new Set(Object.values(pool).flat());
for (const line of Object.values(chosen).flat()) {
  if (!real.has(line)) throw new Error('not in the pool: ' + line);
}
export default { ...pool, ...chosen };`,
}));

// The recording does not show the real pointer, so draw one that follows it.
await page.addInitScript(() => {
  window.addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;'
      + 'background:rgba(23,23,28,.85);border:2px solid #fff;pointer-events:none;z-index:2147483647;transform:translate(-50px,-50px)';
    document.documentElement.append(dot);
    window.addEventListener('mousemove', (event) => {
      dot.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    }, true);
  });
});

const glide = async (x, y) => page.mouse.move(x, y, { steps: 18 });
const centreOf = async (selector) => {
  const box = await page.locator(selector).boundingBox();
  return [box.x + box.width / 2, box.y + box.height / 2];
};
const press = async (selector) => {
  await glide(...await centreOf(selector));
  await page.locator(selector).click({ force: true }); // the duck walks; do not wait for it to hold still
};
const slide = async (id, value) => {
  await glide(...await centreOf(id));
  await page.locator(id).fill(String(value));
  await pause(300);
};
const said = async () => (await page.textContent('#speech-text')).trim();

await page.goto(server.url);
await page.waitForSelector('#maker:not([hidden])');
await page.mouse.move(640, 360);
await pause(900);

// Name the duck.
await press('#duck-name');
await page.fill('#duck-name', '');
await page.type('#duck-name', 'Donald', { delay: 80 });
await pause(500);

// Give it a personality: a Senior Engineer with some sass.
await slide('#slider-sass', 80);
await slide('#slider-energy', 20);
await slide('#slider-helpfulness', 60);
await slide('#slider-speed', 70);
await glide(...await centreOf('#languages input[value="java"]'));
await page.check('#languages input[value="java"]');
await pause(500);

// Two clicks, two lines.
const lines = [];
for (let i = 0; i < 2; i += 1) {
  await press('#duck');
  lines.push(await said());
  await pause(2700);
  await press('#speech-close');
  await pause(400);
}

// Pick it up and drop it.
const [duckX, duckY] = await centreOf('#duck');
await glide(duckX, duckY);
await page.mouse.down();
await page.mouse.move(640, 300, { steps: 30 });
await pause(500);
await page.mouse.up();
await pause(1700);

// Ask it about some code.
await glide(...await centreOf('#duck'));
await page.locator('#duck').dblclick({ force: true });
await pause(1400);
await press('#speech-action');
await pause(400);
await page.fill('#paste-text', SNIPPET); // pasted, as a visitor would
await pause(1300);
await press('#paste-ask');
await page.waitForSelector('#speech:not([hidden])');
await pause(600);
lines.push(await said());
await pause(3600);

const video = await page.video().path();
await context.close();
await browser.close();
server.close();

const expected = [...CHATTER].sort().join('|');
if ([lines[0], lines[1]].sort().join('|') !== expected || lines[2] !== HUNCH.replace('{line}', '5')) {
  throw new Error(`the duck did not say the chosen lines: ${JSON.stringify(lines)}`);
}

const out = join(ROOT, 'docs', 'demo.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-an', '-r', '30',
  '-vf', `scale=${SIZE.width}:${SIZE.height}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
rmSync(dir, { recursive: true, force: true });
console.log(`wrote ${out}`);
console.log(lines.map((line) => `  "${line}"`).join('\n'));
