import { LANGUAGES, scan, checkBrackets, isBareEquals } from './common.js';

const OPENERS = '([{';
const CLOSERS = ')]}';

export function check(text) {
  const scanned = scan(text, LANGUAGES.python);
  const findings = [...scanned.findings];
  const bracket = checkBrackets(scanned.blanked);
  if (bracket) findings.push(bracket);

  const original = text.split('\n');
  const lines = scanned.blanked.split('\n');
  const indented = [];
  let depth = 0;
  let continued = false;

  lines.forEach((line, index) => {
    // Continuation lines (inside brackets or after a backslash) may be
    // indented any way at all, so they are not judged.
    const logicalStart = depth === 0 && !continued && !scanned.startsInString[index];

    if (logicalStart) {
      const condition = /^\s*(?:if|elif|while)\b/.exec(line);
      if (condition && hasBareEquals(line, condition[0].length)) {
        findings.push({ rule: 'R4', kind: 'assign', line: index + 1 });
      }
      if (line.trim()) {
        const lead = /^[ \t]*/.exec(original[index])[0];
        if (lead) indented.push({ line: index + 1, lead });
      }
    }

    for (const ch of line) {
      if (OPENERS.includes(ch)) depth += 1;
      else if (CLOSERS.includes(ch) && depth > 0) depth -= 1;
    }
    continued = /\\\r?$/.test(original[index] || '');
  });

  const indent = checkIndent(indented);
  if (indent) findings.push(indent);
  return { findings, unsure: false };
}

// A bare `=` outside all brackets, between the keyword and the colon that ends
// the condition.
function hasBareEquals(line, from) {
  let depth = 0;
  for (let i = from; i < line.length; i += 1) {
    const ch = line[i];
    if (OPENERS.includes(ch)) depth += 1;
    else if (CLOSERS.includes(ch)) depth -= 1;
    else if (depth === 0 && ch === ':' && line[i + 1] !== '=') return false;
    else if (depth === 0 && isBareEquals(line, i)) return true;
  }
  return false;
}

// R5: tabs and spaces mixed, within one line or across the file.
function checkIndent(indented) {
  const mixed = indented.find((l) => l.lead.includes('\t') && l.lead.includes(' '));
  if (mixed) return { rule: 'R5', kind: 'indent', line: mixed.line };
  if (!indented.length) return null;
  const style = indented[0].lead[0];
  const other = indented.find((l) => l.lead[0] !== style);
  return other ? { rule: 'R5', kind: 'indent', line: other.line } : null;
}
