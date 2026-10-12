"""The web corpus through check_code with the parser on, judged as
tests/corpus.test.js judges it."""

import json
import unittest
from pathlib import Path

from buildaduck.syntax import check_code

TESTS = Path(__file__).resolve().parent
CORPUS = TESTS / '..' / '..' / 'tests' / 'corpus'


def sources(language, group):
    folder = CORPUS / language / group
    return sorted(path for path in folder.iterdir() if not path.name.endswith('.expect.json'))


def read_source(path):
    with open(path, encoding='utf-8', errors='replace', newline='') as handle:
        return handle.read()


def expectation(path):
    with open(str(path) + '.expect.json', encoding='utf-8') as handle:
        return json.load(handle)


def is_caught(result, expected):
    """Kind equal, and the line within 1 unless the kind is `parse`. A sidecar
    without a line never matches another kind, as in the JavaScript."""
    for finding in result['findings']:
        if finding['kind'] != expected['kind']:
            continue
        if expected['kind'] == 'parse':
            return True
        if expected.get('line') is None:
            continue
        if abs((finding['line'] or 0) - expected['line']) <= 1:
            return True
    return False


def live_lists(language):
    """(names of valid files with findings, names of broken files caught)."""
    noisy = {path.name for path in sources(language, 'valid')
             if check_code(read_source(path), language)['findings']}
    caught = {path.name for path in sources(language, 'broken')
              if is_caught(check_code(read_source(path), language), expectation(path))}
    return noisy, caught


class SyntaxCorpusTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(TESTS / 'parity.json', encoding='utf-8') as handle:
            files = json.load(handle)['syntax']['files']
        cls.plain = [entry for entry in files if entry['variant'] == 'plain']

    def recorded_lists(self, language):
        """The same two lists from the JavaScript results in parity.json."""
        noisy = set()
        caught = set()
        names = {'valid': set(), 'broken': set()}
        for entry in self.plain:
            if entry['language'] != language:
                continue
            name = entry['path'].rsplit('/', 1)[1]
            names[entry['group']].add(name)
            result = entry['results'][language]
            if entry['group'] == 'valid':
                if result['findings']:
                    noisy.add(name)
            elif is_caught(result, expectation(CORPUS / language / 'broken' / name)):
                caught.add(name)
        # The comparison means nothing unless parity.json covers the folder.
        for group in ('valid', 'broken'):
            self.assertEqual(names[group], {path.name for path in sources(language, group)})
        return noisy, caught

    def same_lists_as_recorded(self, language):
        noisy, caught = live_lists(language)
        recorded_noisy, recorded_caught = self.recorded_lists(language)
        self.assertEqual(noisy, recorded_noisy)
        self.assertEqual(caught, recorded_caught)

    def test_java_has_the_pages_lists(self):
        self.same_lists_as_recorded('java')

    def test_c_has_the_pages_lists(self):
        self.same_lists_as_recorded('c')

    def test_javascript_has_the_lists_recorded_without_the_parser(self):
        self.same_lists_as_recorded('javascript')

    def test_javascript_valid_files_keep_the_recorded_unsure_value(self):
        recorded = {entry['path'].rsplit('/', 1)[1]: entry['results']['javascript']['unsure']
                    for entry in self.plain
                    if entry['language'] == 'javascript' and entry['group'] == 'valid'}
        for path in sources('javascript', 'valid'):
            result = check_code(read_source(path), 'javascript')
            self.assertEqual(result['unsure'], recorded[path.name], path.name)

    def test_python_valid_files_have_no_finding(self):
        valid = sources('python', 'valid')
        self.assertGreater(len(valid), 0)
        for path in valid:
            result = check_code(read_source(path), 'python')
            self.assertEqual(result, {'status': 'ok', 'findings': [], 'unsure': False}, path.name)

    def test_python_broken_files_are_caught_as_their_sidecars_say(self):
        broken = sources('python', 'broken')
        self.assertGreater(len(broken), 0)
        for path in broken:
            result = check_code(read_source(path), 'python')
            self.assertTrue(is_caught(result, expectation(path)),
                            '%s: %r' % (path.name, result['findings']))


if __name__ == '__main__':
    unittest.main()
