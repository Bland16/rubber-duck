"""Rule P6: Python's own parser beside the heuristics (spec section 9.2)."""

import unittest
from unittest import mock

from buildaduck.syntax import check_code
from buildaduck.syntax import python

# Valid Python that the heuristics flag: R4 reads the lambda's default as an
# assignment in the condition.
VALID_BUT_R4 = 'if lambda x=1: x:\n    pass\n'
R4 = {'rule': 'R4', 'kind': 'assign', 'line': 1}
# A syntax error none of the heuristics can name.
BROKEN_UNNAMED = 'x = = 1\n'


def findings(text, use_parser=True):
    return python.check(text, use_parser)['findings']


def p6(line):
    return [{'rule': 'P6', 'kind': 'parse', 'line': line}]


class PythonParseTest(unittest.TestCase):
    def test_the_two_probe_texts_are_what_the_other_tests_assume(self):
        self.assertEqual(findings(VALID_BUT_R4, use_parser=False), [R4])
        self.assertEqual(findings(BROKEN_UNNAMED, use_parser=False), [])

    def test_parses_drops_bracket_string_and_assign_hunches(self):
        self.assertEqual(findings(VALID_BUT_R4), [])

    def test_parses_keeps_an_indentation_hunch(self):
        text = 'if a:\n\tx = 1\nif b:\n    y = 2\n' + VALID_BUT_R4
        r5 = {'rule': 'R5', 'kind': 'indent', 'line': 4}
        self.assertEqual(findings(text, use_parser=False),
                         [{'rule': 'R4', 'kind': 'assign', 'line': 5}, r5])
        self.assertEqual(findings(text), [r5])

    def test_error_with_heuristic_findings_uses_the_heuristics(self):
        self.assertEqual(findings('if x = 1:\n    pass\n'), [R4])
        self.assertEqual(findings('print((1, 2)\n'),
                         [{'rule': 'R1', 'kind': 'bracket', 'line': 1}])

    def test_tab_error_with_heuristic_findings_uses_the_heuristics(self):
        text = 'if a:\n\tx = 1\n        y = 2\n'
        with self.assertRaises(TabError):
            python.parse_quietly(text)
        self.assertEqual(findings(text), [{'rule': 'R5', 'kind': 'indent', 'line': 3}])

    def test_error_without_heuristic_findings_gives_p6_with_the_line(self):
        self.assertEqual(findings(BROKEN_UNNAMED), p6(1))
        self.assertEqual(findings('a = 1\nb = 2\nc = = 3\n'), p6(3))
        self.assertEqual(findings('def f()\n    return 1\n'), p6(1))

    def test_error_without_a_line_number_gives_p6_with_none(self):
        with mock.patch.object(python.ast, 'parse', side_effect=SyntaxError('no line')):
            self.assertEqual(findings('x = 1\n'), p6(None))

    def test_other_parser_failures_make_p6_unavailable(self):
        for error in (ValueError('v'), RecursionError('r'), MemoryError(), OverflowError('o')):
            with mock.patch.object(python.ast, 'parse', side_effect=error):
                self.assertEqual(findings(VALID_BUT_R4), [R4], repr(error))
                self.assertEqual(findings(BROKEN_UNNAMED), [], repr(error))

    def test_a_lone_surrogate_makes_p6_unavailable(self):
        # ast.parse raises UnicodeEncodeError, a ValueError.
        self.assertEqual(findings(VALID_BUT_R4 + '# \ud83e\n'), [R4])
        self.assertEqual(findings(BROKEN_UNNAMED + '# \ud83e\n'), [])

    def test_a_null_character_makes_p6_unavailable(self):
        self.assertEqual(findings(VALID_BUT_R4 + '# \x00\n'), [R4])
        self.assertEqual(findings(BROKEN_UNNAMED + '# \x00\n'), [])

    def test_a_leading_byte_order_mark_is_ignored(self):
        self.assertEqual(findings('\ufeffx = 1\n'), [])
        self.assertEqual(findings('\ufeff' + VALID_BUT_R4), [])
        self.assertEqual(findings('\ufeff' + BROKEN_UNNAMED), p6(1))
        # Only a leading one.
        self.assertEqual(findings('x = 1\n\ufeffy = 2\n'), p6(2))

    def test_pasted_fragments_give_no_finding(self):
        fragments = [
            'return x + 1',
            '    total = 0\n    for n in items:\n        total += n\n    return total\n',
            '    # add them up\n    total = 0\n    return total\n',
            'await f()',
            'break',
            'yield 1',
        ]
        for text in fragments:
            self.assertEqual(findings(text), [], repr(text))
            self.assertEqual(check_code(text, 'python'),
                             {'status': 'ok', 'findings': [], 'unsure': False}, repr(text))

    def test_a_first_line_indented_deeper_than_a_later_one_gives_a_finding(self):
        self.assertEqual(findings('        x = 1\n    y = 2\n'), p6(1))

    def test_the_second_parse_stands_after_the_dedent(self):
        # Un-indented, the fragment shows its real error, on the same line number.
        self.assertEqual(findings('    x = 1\n    y = = 2\n'), p6(2))

    def test_crlf_line_ends_parse(self):
        self.assertEqual(findings('def f():\r\n    return 1\r\n'), [])
        self.assertEqual(findings('    a = 1\r\n    return a\r\n'), [])

    def test_warnings_are_not_shown_or_raised(self):
        import warnings
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter('error')
            self.assertEqual(findings('x = "\\d"\ny = 1 is 1\n'), [])
        self.assertEqual(caught, [])

    def test_twenty_thousand_characters(self):
        line = 'value = value + 1\n'
        text = (line * (20000 // len(line) + 1))[:20000 - 6] + '\nx = 1'
        self.assertEqual(len(text), 20000)
        self.assertEqual(check_code(text, 'python'),
                         {'status': 'ok', 'findings': [], 'unsure': False})
        broken = text[:-5] + 'x = ='
        result = check_code(broken, 'python')
        self.assertEqual(result['status'], 'ok')
        self.assertEqual([f['rule'] for f in result['findings']], ['P6'])
        self.assertEqual(check_code(text + '1', 'python')['status'], 'too-long')

    def test_use_parser_false_is_the_heuristics_alone(self):
        self.assertEqual(findings(BROKEN_UNNAMED, use_parser=False), [])
        self.assertEqual(check_code(BROKEN_UNNAMED, 'python', use_parser=False)['findings'], [])
        self.assertEqual(check_code(BROKEN_UNNAMED, 'python')['findings'], p6(1))


if __name__ == '__main__':
    unittest.main()
