// Shared scanner and rules for the heuristic syntax check. No DOM.

const OPEN = { '(': ')', '[': ']', '{': '}' };
const CLOSE = { ')': '(', ']': '[', '}': '{' };
const IDENT = /[A-Za-z0-9_$]/;

export const LANGUAGES = {
  java: { lineComment: '//', block: true, triple: ['"""'] },
  c: { lineComment: '//', block: true, raw: true, preprocessor: true, digitSeparator: true },
  javascript: { lineComment: '//', block: true, template: true, regex: true },
  python: { lineComment: '#', triple: ['"""', "'''"] },
};

// Returns the text with string contents and comments replaced by spaces (same
// length, same line breaks; string delimiters kept), plus per-line facts and
// the scanner's own findings (unclosed strings and comments).
export function scan(text, config) {
  const out = [];
  const findings = [];
  const startsInString = [false];
  const preprocessor = [false];
  let line = 1;
  let i = 0;
  let stringReported = false;
  const templates = []; // brace depth of each open `${ ... }`

  const blank = (ch) => out.push(ch === '\n' ? '\n' : ' ');
  const newline = (inString) => {
    line += 1;
    startsInString[line - 1] = inString;
    preprocessor[line - 1] = false;
  };
  const unclosed = new Set(); // lines holding a string that never closes
  const reportString = (at) => {
    unclosed.add(at);
    if (!stringReported) findings.push({ rule: 'R2a', kind: 'string', line: at });
    stringReported = true;
  };
  const lineIsBlankSoFar = () => {
    for (let k = out.length - 1; k >= 0 && out[k] !== '\n'; k -= 1) {
      if (out[k] !== ' ' && out[k] !== '\t') return false;
    }
    return true;
  };

  // Consumes a string whose opening delimiter starts at i. Multi-line strings
  // run to `close`; single-line ones stop at the line end unless it is escaped.
  const consumeString = (open, close, multiline, escapes) => {
    const openLine = line;
    for (const ch of open) out.push(ch);
    i += open.length;
    while (i < text.length) {
      if (text.startsWith(close, i)) {
        // A raw string closes with `)tag"`: only the quote is a delimiter.
        const keep = close[0] === ')' ? 1 : close.length;
        for (let k = 0; k < close.length; k += 1) out.push(k >= close.length - keep ? close[k] : ' ');
        i += close.length;
        return;
      }
      const ch = text[i];
      if (escapes && ch === '\\' && i + 1 < text.length) {
        blank(ch);
        i += 1;
        if (text[i] === '\r' && text[i + 1] === '\n') {
          blank('\r');
          i += 1;
        }
        blank(text[i]);
        if (text[i] === '\n') newline(true);
        i += 1;
        continue;
      }
      if (ch === '\n') {
        if (!multiline) {
          reportString(openLine);
          return; // the line break is handled by the main loop
        }
        blank(ch);
        newline(true);
        i += 1;
        continue;
      }
      blank(ch);
      i += 1;
    }
    reportString(openLine);
  };

  const consumeTemplate = () => {
    // i is just past the opening backtick or a closing `}` of an expression.
    while (i < text.length) {
      const ch = text[i];
      if (ch === '\\' && i + 1 < text.length) {
        blank(ch);
        blank(text[i + 1]);
        if (text[i + 1] === '\n') newline(true);
        i += 2;
      } else if (ch === '`') {
        out.push('`');
        i += 1;
        return true;
      } else if (ch === '$' && text[i + 1] === '{') {
        blank('$');
        blank('{');
        i += 2;
        templates.push({ depth: 0, line: templateLines[templateLines.length - 1] });
        return true;
      } else {
        blank(ch);
        if (ch === '\n') newline(true);
        i += 1;
      }
    }
    return false;
  };
  const templateLines = [];

  while (i < text.length) {
    const ch = text[i];

    if (ch === '\n') {
      out.push('\n');
      newline(false);
      i += 1;
      continue;
    }

    if (config.preprocessor && ch === '#' && lineIsBlankSoFar()) {
      for (;;) {
        preprocessor[line - 1] = true;
        let continued = false;
        while (i < text.length && text[i] !== '\n') {
          continued = text[i] === '\\' || (continued && text[i] === '\r');
          blank(text[i]);
          i += 1;
        }
        if (!continued || i >= text.length) break;
        out.push('\n');
        newline(false);
        i += 1;
      }
      continue;
    }

    if (text.startsWith(config.lineComment, i)) {
      while (i < text.length && text[i] !== '\n') {
        blank(text[i]);
        i += 1;
      }
      continue;
    }

    if (config.block && ch === '/' && text[i + 1] === '*') {
      const openLine = line;
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      while (i < stop) {
        blank(text[i]);
        if (text[i] === '\n') newline(false);
        i += 1;
      }
      if (end === -1) findings.push({ rule: 'R2b', kind: 'comment', line: openLine });
      continue;
    }

    if (config.regex && ch === '/') {
      const end = regexEnd(text, i, out);
      if (end !== -1) {
        while (i < end) {
          blank(text[i]);
          i += 1;
        }
        continue;
      }
    }

    const triple = config.triple && config.triple.find((t) => text.startsWith(t, i));
    if (triple) {
      consumeString(triple, triple, true, true);
      continue;
    }

    if (config.raw && ch === '"' && text[i - 1] === 'R' && !IDENT.test(text[i - 2] || ' ')) {
      const paren = text.indexOf('(', i);
      const tag = paren === -1 ? null : text.slice(i + 1, paren);
      if (tag !== null && tag.length <= 16 && !/[\s\\()"]/.test(tag)) {
        consumeString('"', `)${tag}"`, true, false);
        continue;
      }
    }

    if (config.template && ch === '`') {
      templateLines.push(line);
      out.push('`');
      i += 1;
      if (!consumeTemplate()) reportString(templateLines[templateLines.length - 1]);
      else if (out[out.length - 1] === '`') templateLines.pop();
      continue;
    }

    if (templates.length && (ch === '{' || ch === '}')) {
      const top = templates[templates.length - 1];
      if (ch === '{') top.depth += 1;
      else if (top.depth > 0) top.depth -= 1;
      else {
        templates.pop();
        blank('}');
        i += 1;
        if (!consumeTemplate()) reportString(templateLines[templateLines.length - 1]);
        else if (out[out.length - 1] === '`') templateLines.pop();
        continue;
      }
    }

    if (ch === '"' || ch === "'") {
      const separator = config.digitSeparator && ch === "'"
        && /[0-9a-fA-F]/.test(text[i - 1] || '') && /[0-9a-fA-F]/.test(text[i + 1] || '')
        && /^[0-9a-fA-FxX']*$/.test(lastWord(out));
      if (separator) {
        out.push(' ');
        i += 1;
        continue;
      }
      consumeString(ch, ch, false, true);
      continue;
    }

    out.push(ch);
    i += 1;
  }

  if (templates.length) reportString(templates[0].line);

  return { blanked: out.join(''), findings, startsInString, preprocessor, unclosed };
}

const REGEX_AFTER_WORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'void',
  'delete', 'throw', 'new', 'yield', 'await', 'instanceof']);

// If the `/` at index i starts a regular-expression literal, returns the index
// just past it (flags included); otherwise -1. A `/` is a regex when what comes
// before it cannot end an expression.
function regexEnd(text, i, out) {
  let k = out.length - 1;
  while (k >= 0 && (out[k] === ' ' || out[k] === '\t' || out[k] === '\n' || out[k] === '\r')) k -= 1;
  if (k >= 0) {
    const prev = out[k];
    if (IDENT.test(prev)) {
      let w = k;
      while (w >= 0 && IDENT.test(out[w])) w -= 1;
      if (!REGEX_AFTER_WORDS.has(out.slice(w + 1, k + 1).join(''))) return -1;
    } else if (!'(,=:[!&|?{};+-*%<>~^'.includes(prev)) return -1;
  }
  let inClass = false;
  for (let j = i + 1; j < text.length; j += 1) {
    const ch = text[j];
    if (ch === '\n') return -1;
    if (ch === '\\') j += 1;
    else if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) {
      let end = j + 1;
      while (end < text.length && /[a-z]/.test(text[end])) end += 1;
      return end;
    }
  }
  return -1;
}

function lastWord(out) {
  let k = out.length - 1;
  while (k >= 0 && /[A-Za-z0-9_']/.test(out[k])) k -= 1;
  return out.slice(k + 1).join('');
}

// R1: the first bracket problem, or null.
export function checkBrackets(blanked) {
  const stack = [];
  let line = 1;
  for (const ch of blanked) {
    if (ch === '\n') line += 1;
    else if (OPEN[ch]) stack.push({ ch, line });
    else if (CLOSE[ch]) {
      const top = stack[stack.length - 1];
      if (!top || top.ch !== CLOSE[ch]) return { rule: 'R1', kind: 'bracket', line };
      stack.pop();
    }
  }
  if (stack.length) return { rule: 'R1', kind: 'bracket', line: stack[stack.length - 1].line };
  return null;
}

// True when the `=` at index i is a plain assignment, not part of a comparison,
// arrow, walrus or compound assignment.
export function isBareEquals(text, i) {
  if (text[i] !== '=') return false;
  const prev = text[i - 1] || '';
  const next = text[i + 1] || '';
  if (next === '=' || next === '>') return false;
  return !'=!<>+-*/%&|^:?~'.includes(prev) || prev === '';
}

// R4 for brace languages: a bare `=` directly inside the parentheses of an
// `if` or `while`, not nested any deeper. One pass over the text.
export function checkConditionAssign(blanked) {
  const lines = new Set();
  const stack = []; // open brackets; condition parentheses carry the lines they would flag
  const keyword = /\b(?:if|while)\s*\(/g;
  const conditionStarts = new Set();
  let match;
  while ((match = keyword.exec(blanked))) conditionStarts.add(match.index + match[0].length - 1);

  let line = 1;
  for (let i = 0; i < blanked.length; i += 1) {
    const ch = blanked[i];
    const top = stack[stack.length - 1];
    if (ch === '\n') line += 1;
    else if (OPEN[ch]) {
      // A brace directly inside a condition means its parenthesis never closed.
      if (ch === '{' && top && top.flagged) top.dead = true;
      stack.push(conditionStarts.has(i) ? { ch, flagged: [], dead: false } : { ch });
    } else if (CLOSE[ch]) {
      let k = stack.length - 1;
      while (k >= 0 && stack[k].ch !== CLOSE[ch]) k -= 1;
      if (k >= 0) {
        for (const entry of stack.splice(k)) {
          if (entry.flagged && !entry.dead) entry.flagged.forEach((n) => lines.add(n));
        }
      }
    } else if (top && top.flagged && !top.dead) {
      // `if (init; condition)` in C++17: the part before the `;` is a declaration.
      if (ch === ';') top.flagged.length = 0;
      else if (isBareEquals(blanked, i)) top.flagged.push(line);
    }
  }
  for (const entry of stack) if (entry.flagged && !entry.dead) entry.flagged.forEach((n) => lines.add(n));
  return [...lines].sort((x, y) => x - y).map((n) => ({ rule: 'R4', kind: 'assign', line: n }));
}

const BLOCK_WORDS = new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'try', 'catch',
  'finally', 'class', 'interface', 'enum', 'struct', 'union', 'namespace', 'template']);
const STATEMENT_WORDS = new Set(['return', 'break', 'continue', 'throw', 'goto', 'import',
  'package', 'using']);
const CONTINUATION_WORDS = new Set(['extends', 'implements', 'throws']);

export function firstWord(line) {
  const match = /^[\s}]*([A-Za-z_]\w*)/.exec(line);
  return match ? match[1] : null;
}

// R3: missing semicolons in Java and C-family code. Returns confident findings
// and whether any unconfident candidate was seen.
export function checkSemicolons(scanned) {
  const lines = scanned.blanked.split('\n').map((l) => l.replace(/\r$/, ''));
  const trimmed = lines.map((l) => l.trim());
  const nextNonBlank = (index) => {
    for (let k = index + 1; k < lines.length; k += 1) if (trimmed[k]) return k;
    return -1;
  };
  const prevNonBlank = (index) => {
    for (let k = index - 1; k >= 0; k -= 1) if (trimmed[k]) return k;
    return -1;
  };

  const stack = [];
  const findings = [];
  let unsure = false;

  lines.forEach((text, index) => {
    const enclosing = [...stack].reverse().find((b) => b.ch === '{');
    const inDataBrace = Boolean(enclosing && enclosing.data);
    let lastCloser = null; // info about the `(` matched by this line's final `)`
    let bareEquals = false;

    for (let col = 0; col < text.length; col += 1) {
      const ch = text[col];
      if (OPEN[ch]) {
        const entry = { ch, line: index, col };
        if (ch === '{') {
          const before = text.slice(0, col).trim();
          const prev = prevNonBlank(index);
          entry.data = /(?:[=,(\[{\]]|\breturn)$/.test(before)
            || (before === '' && prev !== -1 && trimmed[prev].endsWith('='))
            || /\benum\b/.test(before)
            || (before === '' && prev !== -1 && /\benum\b/.test(trimmed[prev]));
        }
        stack.push(entry);
      } else if (CLOSE[ch]) {
        let k = stack.length - 1;
        while (k >= 0 && stack[k].ch !== CLOSE[ch]) k -= 1;
        if (k >= 0) {
          const opener = stack[k];
          stack.length = k;
          if (ch === ')') lastCloser = { col, opener };
        }
      } else if (isBareEquals(text, col) && stack.every((b) => b.ch === '{')) {
        bareEquals = true;
      }
    }

    const line = trimmed[index];
    if (!line) return;
    const last = line[line.length - 1];
    const endsIncrement = /(\+\+|--)$/.test(line);

    // (a) to (g): is this line a candidate?
    if (!/[A-Za-z0-9_)\]"']/.test(last) && !endsIncrement) return;
    if (stack.some((b) => b.ch !== '{')) return;
    const word = firstWord(line);
    if (BLOCK_WORDS.has(word)) return;
    if (line.startsWith('@') || scanned.preprocessor[index] || scanned.startsInString[index]) return;
    if (scanned.unclosed.has(index + 1)) return; // already reported as an unclosed string
    if (inDataBrace) return;
    const next = nextNonBlank(index);
    if (next !== -1) {
      const following = trimmed[next];
      if ('{.?:)]"+-*/%&|^<>='.includes(following[0])) return;
      if (CONTINUATION_WORDS.has(firstWord(following))) return;
    }
    const closesHere = last === ')' && lastCloser && lastCloser.col === text.trimEnd().length - 1
      ? lastCloser.opener : null;
    if (closesHere && closesHere.line < index && BLOCK_WORDS.has(firstWord(trimmed[closesHere.line]))) return;

    // (h) and (i): is the candidate confident?
    let isCall = false;
    if (closesHere) {
      const before = lines[closesHere.line].slice(0, closesHere.col).trimEnd();
      isCall = /[A-Za-z0-9_]$/.test(before);
    }
    const shaped = bareEquals || STATEMENT_WORDS.has(word) || endsIncrement || isCall;
    const startsStatement = next === -1 || /^[A-Za-z_}@#]/.test(trimmed[next]);
    if (shaped && startsStatement) findings.push({ rule: 'R3', kind: 'semicolon', line: index + 1 });
    else unsure = true;
  });

  return { findings, unsure };
}

export function braceLanguageCheck(text, config) {
  const scanned = scan(text, config);
  const findings = [...scanned.findings];
  const bracket = checkBrackets(scanned.blanked);
  if (bracket) findings.push(bracket);
  const semi = checkSemicolons(scanned);
  findings.push(...semi.findings, ...checkConditionAssign(scanned.blanked));
  return { findings, unsure: semi.unsure };
}
