"""Every syntax case in parity.json gives the same result in Python as it did
in JavaScript (checkCode with useParser: false, and guessLanguage)."""

import json
import re
import unittest
from pathlib import Path

from buildaduck.syntax import LANGUAGE_ORDER, check_code, guess_language

TESTS = Path(__file__).resolve().parent
ROOT = TESTS.parents[1]


def load_syntax_parity():
    with open(TESTS / 'parity.json', encoding='utf-8') as handle:
        return json.load(handle)['syntax']


def read_source(path):
    # As Node's readFileSync(path, 'utf8'): no newline translation, a byte-order
    # mark kept, bad bytes replaced.
    with open(ROOT / path, encoding='utf-8', errors='replace', newline='') as handle:
        return handle.read()


def variant_text(source, variant, language):
    """VARIANTS in tools/export_desktop.mjs."""
    if variant == 'plain':
        return source
    if variant == 'crlf':
        return re.sub(r'\r?\n', '\r\n', source)
    if variant == 'nonascii':
        mark = '#' if language == 'python' else '//'
        return mark + ' café 鴨 \U0001f986\n' + source
    raise ValueError('unknown variant ' + variant)


class SyntaxParityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.parity = load_syntax_parity()

    def compare(self, label, text, results, differences):
        self.assertEqual(sorted(results), sorted(LANGUAGE_ORDER), label)
        for language in LANGUAGE_ORDER:
            got = check_code(text, language, use_parser=False)
            if got != results[language]:
                differences.append('%s as %s: got %r, expected %r'
                                   % (label, language, got, results[language]))

    def report(self, differences, compared):
        self.assertGreater(compared, 0)
        self.assertEqual(differences, [], '%d of %d differ; first: %s'
                         % (len(differences), compared, differences[:3]))

    def test_files(self):
        differences = []
        entries = self.parity['files']
        for entry in entries:
            text = variant_text(read_source(entry['path']), entry['variant'], entry['language'])
            self.compare('%s (%s)' % (entry['path'], entry['variant']), text,
                         entry['results'], differences)
        self.report(differences, len(entries))

    def test_every_corpus_file_has_all_three_variants(self):
        seen = {}
        for entry in self.parity['files']:
            seen.setdefault(entry['path'], set()).add(entry['variant'])
        on_disk = {path.relative_to(ROOT).as_posix()
                   for path in (ROOT / 'tests' / 'corpus').glob('*/*/*')
                   if not path.name.endswith('.expect.json')}
        self.assertEqual(set(seen), on_disk)
        for path, variants in seen.items():
            self.assertEqual(variants, {'plain', 'crlf', 'nonascii'}, path)

    def test_texts(self):
        differences = []
        entries = self.parity['texts']
        for entry in entries:
            self.compare(repr(entry['text']), entry['text'], entry['results'], differences)
        self.report(differences, len(entries))

    def test_guesses(self):
        differences = []
        entries = self.parity['guesses']
        for entry in entries:
            text = variant_text(read_source(entry['path']), entry['variant'], None)
            got = guess_language(text, entry['offered'])
            if got != entry['guess']:
                differences.append('%s (%s) offered %r: got %r, expected %r'
                                   % (entry['path'], entry['variant'], entry['offered'],
                                      got, entry['guess']))
        self.report(differences, len(entries))

    def test_limits(self):
        differences = []
        entries = self.parity['limits']
        for entry in entries:
            how, unit, count = entry['build']
            self.assertEqual(how, 'repeat')
            self.compare('%r x %d' % (unit, count), unit * count, entry['results'], differences)
        self.report(differences, len(entries))


if __name__ == '__main__':
    unittest.main()
