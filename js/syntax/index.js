import { check as checkJava } from './java.js';
import { check as checkC } from './c.js';
import { check as checkJavaScript } from './javascript.js';
import { check as checkPython } from './python.js';

export const MAX_PASTE = 20000;
export const LANGUAGE_ORDER = ['java', 'javascript', 'python', 'c'];

const CHECKERS = { java: checkJava, c: checkC, javascript: checkJavaScript, python: checkPython };
const KIND_ORDER = ['string', 'comment', 'bracket', 'parse', 'semicolon', 'assign', 'indent'];

const MARKERS = {
  python: [/def /, /elif /, /^import /m, /^(?:if |for |while |class ).*:[ \t]*$/m],
  java: [/public class/, /System\.out/, /import java/],
  c: [/#include/, /std::/, /printf\(/, /int main/],
  javascript: [/function /, /const /, /let /, /=>/, /console\./],
};

// The offered language with the most distinct markers; the first on a tie.
export function guessLanguage(text, offered) {
  let best = offered[0];
  let bestScore = 0;
  for (const language of offered) {
    const score = MARKERS[language].filter((marker) => marker.test(text)).length;
    if (score > bestScore) {
      best = language;
      bestScore = score;
    }
  }
  return best;
}

export function checkCode(text, language) {
  if (!text.trim()) return { status: 'empty', findings: [], unsure: false };
  if (text.length > MAX_PASTE) return { status: 'too-long', findings: [], unsure: false };
  const { findings, unsure } = CHECKERS[language](text);
  findings.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
    || (a.line ?? 0) - (b.line ?? 0));
  return { status: 'ok', findings, unsure };
}
