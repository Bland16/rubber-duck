// The desktop duck's generated files must match what the JavaScript gives today.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from '../tools/export_desktop.mjs';

test('the files generated for the desktop duck are up to date', () => {
  for (const [path, content] of Object.entries(build())) {
    let committed = null;
    try {
      committed = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    } catch {
      // reported below
    }
    assert.ok(committed !== null, `${path} is missing; run node tools/export_desktop.mjs`);
    assert.ok(committed === content, `${path} is out of date; run node tools/export_desktop.mjs`);
  }
});
