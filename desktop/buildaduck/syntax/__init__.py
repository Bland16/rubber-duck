"""The code check: a port of js/syntax/. No tkinter, no file access."""

import re

from . import c, java, javascript, python
from .common import LINE_START, LINE_END, NOT_LINE_END, js_trim, to_units

MAX_PASTE = 20000
LANGUAGE_ORDER = ['java', 'javascript', 'python', 'c']

CHECKERS = {'java': java.check, 'c': c.check, 'javascript': javascript.check,
            'python': python.check}
KIND_ORDER = ['string', 'comment', 'bracket', 'parse', 'semicolon', 'assign', 'indent']

# None of these patterns can tell a surrogate pair from one character, so they
# read the text as it comes.
MARKERS = {
    'python': [re.compile(r'def '), re.compile(r'elif '),
               re.compile(LINE_START + r'import '),
               re.compile(LINE_START + r'(?:if |for |while |class )' + NOT_LINE_END
                          + r'*:[ \t]*' + LINE_END)],
    'java': [re.compile(r'public class'), re.compile(r'System\.out'),
             re.compile(r'import java')],
    'c': [re.compile(r'#include'), re.compile(r'std::'), re.compile(r'printf\('),
          re.compile(r'int main')],
    'javascript': [re.compile(r'function '), re.compile(r'const '), re.compile(r'let '),
                   re.compile(r'=>'), re.compile(r'console\.')],
}


def guess_language(text, offered):
    """The offered language with the most distinct markers; the first on a tie."""
    best = offered[0]
    best_score = 0
    for language in offered:
        score = sum(1 for marker in MARKERS[language] if marker.search(text))
        if score > best_score:
            best = language
            best_score = score
    return best


def kind_rank(finding):
    kind = finding['kind']
    rank = KIND_ORDER.index(kind) if kind in KIND_ORDER else -1
    return rank, finding['line'] or 0


def check_code(text, language, use_parser=True):
    if not js_trim(text):
        return {'status': 'empty', 'findings': [], 'unsure': False}
    if len(to_units(text)) > MAX_PASTE:
        return {'status': 'too-long', 'findings': [], 'unsure': False}
    result = CHECKERS[language](text, use_parser)
    # A stable sort, as JavaScript's is.
    findings = sorted(result['findings'], key=kind_rank)
    return {'status': 'ok', 'findings': findings, 'unsure': result['unsure']}
