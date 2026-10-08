// covers: a module with import and export; arrow functions
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_ENCODING,
  MAX_BYTES,
} from './constants.js';

export const configPath = (dir) => path.join(dir, 'duck.config.json');

export async function loadConfig(dir) {
  const raw = await readFile(configPath(dir), DEFAULT_ENCODING);
  if (raw.length > MAX_BYTES) {
    throw new Error(`config too large: ${raw.length} bytes`);
  }
  return JSON.parse(raw);
}

export async function saveConfig(dir, config) {
  const text = JSON.stringify(config, null, 2);
  await writeFile(configPath(dir), text + '\n', DEFAULT_ENCODING);
}

function merge(base, extra) {
  return { ...base, ...extra };
}

export { merge as mergeConfig };
export default loadConfig;
