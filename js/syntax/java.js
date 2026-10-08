import { LANGUAGES, braceLanguageCheck } from './common.js';

export function check(text) {
  return braceLanguageCheck(text, LANGUAGES.java);
}
