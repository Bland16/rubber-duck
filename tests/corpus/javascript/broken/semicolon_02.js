import { readFile } from 'node:fs/promises';

async function load(path) {
  const text = await readFile(path, 'utf8');
  const lines = text.split('\n');
  console.log(`read ${lines.length} lines`)
  return lines.filter((line) => line.trim() !== '');
}

load('notes.txt').then((lines) => {
  console.log(lines.join('\n'));
});
