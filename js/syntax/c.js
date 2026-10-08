import { LANGUAGES, braceLanguageCheck } from './common.js';

// C and C++.
export function check(text) {
  return braceLanguageCheck(text, LANGUAGES.c);
}
