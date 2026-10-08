import { LANGUAGES, scan, checkBrackets, checkConditionAssign } from './common.js';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

export function check(text) {
  const scanned = scan(text, LANGUAGES.javascript);
  const structural = [...scanned.findings];
  const bracket = checkBrackets(scanned.blanked);
  if (bracket) structural.push(bracket);
  const assign = checkConditionAssign(scanned.blanked);

  const parsed = parse(text, scanned);
  let findings;
  if (parsed === 'ok') findings = assign;
  else if (parsed === 'unavailable' || structural.length) findings = [...structural, ...assign];
  else findings = [{ rule: 'R6', kind: 'parse', line: null }, ...assign];
  return { findings, unsure: false };
}

// R6: ask the engine to compile the code. The function is never called, and
// the engine's message is discarded.
export function parse(text, scanned) {
  if (/\bimport\s*\.\s*meta\b/.test(scanned.blanked)) return 'unavailable';
  try {
    // eslint-disable-next-line no-new
    new AsyncFunction(prepare(text, scanned));
    return 'ok';
  } catch (error) {
    return error instanceof SyntaxError ? 'error' : 'unavailable';
  }
}

// Module syntax is not valid inside a function body, so it is blanked out or
// rewritten in place, keeping every line break.
export function prepare(text, scanned) {
  const chars = text.split('');
  const blanked = scanned.blanked;
  const erase = (from, to) => {
    for (let i = from; i < to && i < chars.length; i += 1) if (chars[i] !== '\n') chars[i] = ' ';
  };

  if (text.startsWith('#!')) erase(0, text.indexOf('\n') === -1 ? chars.length : text.indexOf('\n'));

  let offset = 0;
  blanked.split('\n').forEach((line, index) => {
    const start = offset;
    offset += line.length + 1;
    if (scanned.startsInString[index]) return;
    const match = /^[ \t]*(import|export)\b/.exec(line);
    if (!match) return;
    const word = start + match[0].length - match[1].length;
    const after = start + match[0].length;
    const rest = blanked.slice(after);

    if (match[1] === 'import') {
      if (/^\s*[(.]/.test(rest)) return;
      const quote = rest.search(/["']/);
      if (quote === -1) return;
      const open = after + quote;
      const close = blanked.indexOf(blanked[open], open + 1);
      if (close !== -1) erase(word, close + 1);
      return;
    }

    const asDefault = /^\s+default\b/.exec(rest);
    if (asDefault) {
      erase(word, after + asDefault[0].length);
      'void'.split('').forEach((ch, k) => { chars[word + k] = ch; });
    } else if (/^\s*[{*]/.test(rest)) {
      const brace = /^\s*\{/.test(rest) ? blanked.indexOf('}', after) : after;
      const from = brace === -1 ? after : brace;
      const lineEnd = blanked.indexOf('\n', from);
      erase(word, lineEnd === -1 ? chars.length : lineEnd);
    } else {
      erase(word, after);
    }
  });
  return chars.join('');
}
