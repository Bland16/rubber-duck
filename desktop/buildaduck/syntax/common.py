"""Shared scanner and rules for the heuristic syntax check.

A port of js/syntax/common.js. Every function here expects text already passed
through to_units, so that indices and lengths are UTF-16 code units as they are
in JavaScript.
"""

import re
import struct

OPEN = {'(': ')', '[': ']', '{': '}'}
CLOSE = {')': '(', ']': '[', '}': '{'}

# What JavaScript's \s matches and trim() strips: ECMAScript WhiteSpace plus
# LineTerminator. Python's own set also has U+001C to U+001F and U+0085, and
# lacks U+FEFF.
JS_SPACE = ('\t\n\x0b\x0c\r \xa0 '
            '           '
            '    　﻿')
WS = '[' + JS_SPACE + ']'
# JavaScript's multiline ^ and $ and its . stop at all four of these.
LINE_ENDS = '\n\r  '
LINE_START = '(?<![^' + LINE_ENDS + '])'
LINE_END = '(?![^' + LINE_ENDS + '])'
NOT_LINE_END = '[^' + LINE_ENDS + ']'

IDENT = re.compile(r'[A-Za-z0-9_$]')
HEX_DIGIT = re.compile(r'[0-9a-fA-F]')
HEX_WORD = re.compile(r"[0-9a-fA-FxX']*")
WORD_OR_QUOTE = re.compile(r"[A-Za-z0-9_']")
RAW_TAG_STOP = re.compile('[' + JS_SPACE + r'\\()"]')
REGEX_FLAG = re.compile(r'[a-z]')

LANGUAGES = {
    'java': {'line_comment': '//', 'block': True, 'triple': ['"""']},
    'c': {'line_comment': '//', 'block': True, 'raw': True, 'preprocessor': True,
          'digit_separator': True},
    'javascript': {'line_comment': '//', 'block': True, 'template': True, 'regex': True},
    'python': {'line_comment': '#', 'triple': ['"""', "'''"]},
}


def to_units(text):
    """The text with each UTF-16 code unit as one character (surrogates apart)."""
    if not text or max(text) <= '￿':
        return text
    raw = text.encode('utf-16-le', 'surrogatepass')
    return ''.join(map(chr, struct.unpack('<%dH' % (len(raw) // 2), raw)))


def js_trim(text):
    return text.strip(JS_SPACE)


def js_trim_end(text):
    return text.rstrip(JS_SPACE)


def at(seq, index):
    """seq[index], or '' where JavaScript gives undefined (Python would wrap or raise)."""
    return seq[index] if 0 <= index < len(seq) else ''


def scan(text, config):
    """Returns the text with string contents and comments replaced by spaces
    (same length, same line breaks; string delimiters kept), plus per-line facts
    and the scanner's own findings (unclosed strings and comments)."""
    out = []
    findings = []
    starts_in_string = [False]
    preprocessor = [False]
    line = 1
    i = 0
    string_reported = False
    templates = []  # brace depth of each open `${ ... }`
    template_lines = []
    no_slash_line = 0
    unclosed = set()  # lines holding a string that never closes
    length = len(text)
    line_comment = config['line_comment']
    triples = config.get('triple')

    def blank(ch):
        out.append('\n' if ch == '\n' else ' ')

    def newline(in_string):
        nonlocal line
        line += 1
        starts_in_string.append(in_string)
        preprocessor.append(False)

    def report_string(where):
        nonlocal string_reported
        unclosed.add(where)
        if not string_reported:
            findings.append({'rule': 'R2a', 'kind': 'string', 'line': where})
        string_reported = True

    def line_is_blank_so_far():
        k = len(out) - 1
        while k >= 0 and out[k] != '\n':
            if out[k] != ' ' and out[k] != '\t':
                return False
            k -= 1
        return True

    def template_line():
        return template_lines[-1] if template_lines else None

    def consume_string(open_, close, multiline, escapes):
        """Consumes a string whose opening delimiter starts at i. Multi-line
        strings run to `close`; single-line ones stop at the line end unless it
        is escaped."""
        nonlocal i
        open_line = line
        out.extend(open_)
        i += len(open_)
        while i < length:
            if text.startswith(close, i):
                # A raw string closes with `)tag"`: only the quote is a delimiter.
                keep = 1 if close[0] == ')' else len(close)
                for k in range(len(close)):
                    out.append(close[k] if k >= len(close) - keep else ' ')
                i += len(close)
                return
            ch = text[i]
            if escapes and ch == '\\' and i + 1 < length:
                blank(ch)
                i += 1
                if text[i] == '\r' and at(text, i + 1) == '\n':
                    blank('\r')
                    i += 1
                blank(text[i])
                if text[i] == '\n':
                    newline(True)
                i += 1
                continue
            if ch == '\n':
                if not multiline:
                    report_string(open_line)
                    return  # the line break is handled by the main loop
                blank(ch)
                newline(True)
                i += 1
                continue
            blank(ch)
            i += 1
        report_string(open_line)

    def consume_template():
        # i is just past the opening backtick or a closing `}` of an expression.
        nonlocal i
        while i < length:
            ch = text[i]
            if ch == '\\' and i + 1 < length:
                blank(ch)
                blank(text[i + 1])
                if text[i + 1] == '\n':
                    newline(True)
                i += 2
            elif ch == '`':
                out.append('`')
                i += 1
                return True
            elif ch == '$' and at(text, i + 1) == '{':
                blank('$')
                blank('{')
                i += 2
                templates.append({'depth': 0, 'line': template_line()})
                return True
            else:
                blank(ch)
                if ch == '\n':
                    newline(True)
                i += 1
        return False

    while i < length:
        ch = text[i]

        if ch == '\n':
            out.append('\n')
            newline(False)
            i += 1
            continue

        if config.get('preprocessor') and ch == '#' and line_is_blank_so_far():
            while True:
                preprocessor[line - 1] = True
                continued = False
                while i < length and text[i] != '\n':
                    continued = text[i] == '\\' or (continued and text[i] == '\r')
                    blank(text[i])
                    i += 1
                if not continued or i >= length:
                    break
                out.append('\n')
                newline(False)
                i += 1
            continue

        if text.startswith(line_comment, i):
            while i < length and text[i] != '\n':
                blank(text[i])
                i += 1
            continue

        if config.get('block') and ch == '/' and at(text, i + 1) == '*':
            open_line = line
            end = text.find('*/', i + 2)
            stop = length if end == -1 else end + 2
            while i < stop:
                blank(text[i])
                if text[i] == '\n':
                    newline(False)
                i += 1
            if end == -1:
                findings.append({'rule': 'R2b', 'kind': 'comment', 'line': open_line})
            continue

        if config.get('regex') and ch == '/' and no_slash_line != line:
            end = regex_end(text, i, out)
            if end == -2:
                no_slash_line = line  # nothing on this line can close a regex
            if end >= 0:
                while i < end:
                    blank(text[i])
                    i += 1
                continue

        triple = None
        if triples:
            triple = next((t for t in triples if text.startswith(t, i)), None)
        if triple:
            consume_string(triple, triple, True, True)
            continue

        if (config.get('raw') and ch == '"' and at(text, i - 1) == 'R'
                and not IDENT.search(at(text, i - 2) or ' ')):
            paren = text.find('(', i)
            tag = None if paren == -1 else text[i + 1:paren]
            if tag is not None and len(tag) <= 16 and not RAW_TAG_STOP.search(tag):
                consume_string('"', ')' + tag + '"', True, False)
                continue

        if config.get('template') and ch == '`':
            template_lines.append(line)
            out.append('`')
            i += 1
            if not consume_template():
                report_string(template_line())
            elif out[-1] == '`':
                template_lines.pop()
            continue

        if templates and (ch == '{' or ch == '}'):
            top = templates[-1]
            if ch == '{':
                top['depth'] += 1
            elif top['depth'] > 0:
                top['depth'] -= 1
            else:
                templates.pop()
                blank('}')
                i += 1
                if not consume_template():
                    report_string(template_line())
                elif out[-1] == '`':
                    template_lines.pop()
                continue

        if ch == '"' or ch == "'":
            separator = (config.get('digit_separator') and ch == "'"
                         and HEX_DIGIT.search(at(text, i - 1))
                         and HEX_DIGIT.search(at(text, i + 1))
                         and HEX_WORD.fullmatch(last_word(out)))
            if separator:
                out.append(' ')
                i += 1
                continue
            consume_string(ch, ch, False, True)
            continue

        out.append(ch)
        i += 1

    if templates:
        report_string(templates[0]['line'])

    return {'blanked': ''.join(out), 'findings': findings,
            'starts_in_string': starts_in_string, 'preprocessor': preprocessor,
            'unclosed': unclosed}


REGEX_AFTER_WORDS = {'return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'void',
                     'delete', 'throw', 'new', 'yield', 'await', 'instanceof'}
REGEX_AFTER_MARKS = set('(,=:[!&|?{};+-*%<>~^')


def regex_end(text, i, out):
    """If the `/` at index i starts a regular-expression literal, returns the
    index just past it (flags included). Otherwise -1, or -2 when the rest of
    the line holds no closing slash. A `/` is a regex when what comes before it
    cannot end an expression."""
    k = len(out) - 1
    while k >= 0 and out[k] in (' ', '\t', '\n', '\r'):
        k -= 1
    if k >= 0:
        prev = out[k]
        if IDENT.search(prev):
            w = k
            while w >= 0 and IDENT.search(out[w]):
                w -= 1
            if ''.join(out[w + 1:k + 1]) not in REGEX_AFTER_WORDS:
                return -1
        elif prev not in REGEX_AFTER_MARKS:
            return -1
    in_class = False
    length = len(text)
    j = i + 1
    while j < length:
        ch = text[j]
        if ch == '\n':
            return -2
        if ch == '\\':
            j += 1
        elif ch == '[':
            in_class = True
        elif ch == ']':
            in_class = False
        elif ch == '/' and not in_class:
            end = j + 1
            while end < length and REGEX_FLAG.search(text[end]):
                end += 1
            return end
        j += 1
    return -2


def last_word(out):
    k = len(out) - 1
    while k >= 0 and WORD_OR_QUOTE.search(out[k]):
        k -= 1
    return ''.join(out[k + 1:])


def check_brackets(blanked):
    """R1: the first bracket problem, or None."""
    stack = []
    line = 1
    for ch in blanked:
        if ch == '\n':
            line += 1
        elif ch in OPEN:
            stack.append({'ch': ch, 'line': line})
        elif ch in CLOSE:
            top = stack[-1] if stack else None
            if not top or top['ch'] != CLOSE[ch]:
                return {'rule': 'R1', 'kind': 'bracket', 'line': line}
            stack.pop()
    if stack:
        return {'rule': 'R1', 'kind': 'bracket', 'line': stack[-1]['line']}
    return None


NOT_BEFORE_BARE_EQUALS = set('=!<>+-*/%&|^:?~')


def is_bare_equals(text, i):
    """True when the `=` at index i is a plain assignment, not part of a
    comparison, arrow, walrus or compound assignment."""
    if at(text, i) != '=':
        return False
    prev = at(text, i - 1)
    following = at(text, i + 1)
    if following == '=' or following == '>':
        return False
    return prev not in NOT_BEFORE_BARE_EQUALS


CONDITION_KEYWORD = re.compile(r'\b(?:if|while)' + WS + r'*\(', re.ASCII)


def check_condition_assign(blanked):
    """R4 for brace languages: a bare `=` directly inside the parentheses of an
    `if` or `while`, not nested any deeper. One pass over the text."""
    lines = set()
    stack = []  # open brackets; condition parentheses carry the lines they would flag
    condition_starts = {match.end() - 1 for match in CONDITION_KEYWORD.finditer(blanked)}

    def live(entry):
        # An empty `flagged` list still marks a condition, as in JavaScript.
        return entry is not None and 'flagged' in entry and not entry['dead']

    line = 1
    for i, ch in enumerate(blanked):
        top = stack[-1] if stack else None
        if ch == '\n':
            line += 1
        elif ch in OPEN:
            # A brace directly inside a condition means its parenthesis never closed.
            if ch == '{' and top is not None and 'flagged' in top:
                top['dead'] = True
            if i in condition_starts:
                stack.append({'ch': ch, 'flagged': [], 'dead': False})
            else:
                stack.append({'ch': ch})
        elif ch in CLOSE:
            k = len(stack) - 1
            while k >= 0 and stack[k]['ch'] != CLOSE[ch]:
                k -= 1
            if k >= 0:
                for entry in stack[k:]:
                    if live(entry):
                        lines.update(entry['flagged'])
                del stack[k:]
        elif live(top):
            # `if (init; condition)` in C++17: the part before the `;` is a declaration.
            if ch == ';':
                top['flagged'].clear()
            elif is_bare_equals(blanked, i):
                top['flagged'].append(line)
    for entry in stack:
        if live(entry):
            lines.update(entry['flagged'])
    return [{'rule': 'R4', 'kind': 'assign', 'line': n} for n in sorted(lines)]


BLOCK_WORDS = {'if', 'else', 'for', 'while', 'do', 'switch', 'try', 'catch',
               'finally', 'class', 'interface', 'enum', 'struct', 'union', 'namespace',
               'template'}
STATEMENT_WORDS = {'return', 'break', 'continue', 'throw', 'goto', 'import',
                   'package', 'using'}
CONTINUATION_WORDS = {'extends', 'implements', 'throws'}
# A line ending in one of these is not finished, whatever comes next.
OPEN_ENDED_WORDS = re.compile(
    r'\b(?:else|do|return|typeof|in|of|new|delete|void|throw|case|yield|await|instanceof|default|break|continue)\Z',
    re.ASCII)
HABIT_MIN_LINES = 5
HABIT_SHARE = 0.8

FIRST_WORD = re.compile('[' + JS_SPACE + r'}]*([A-Za-z_]\w*)', re.ASCII)
# \Z, not $: Python's $ also matches before a final line feed.
DATA_BRACE_BEFORE = re.compile(r'(?:[=,(\[{\]]|\breturn|\bdefault)\Z', re.ASCII)
ENUM_WORD = re.compile(r'\benum\b', re.ASCII)
CANDIDATE_END = re.compile(r'[A-Za-z0-9_)\]"\']')
CALL_BEFORE = re.compile(r'[A-Za-z0-9_]\Z')
STATEMENT_START = re.compile(r'[A-Za-z_}@#]')
SKIP_BEFORE = set('{.?:)]"+-*/%&|^<>=')
HAZARD_START = set('([`')


def first_word(line):
    match = FIRST_WORD.match(line)
    return match.group(1) if match else None


def split_lines(blanked):
    """Lines split at line feeds, each without one final carriage return."""
    return [l[:-1] if l.endswith('\r') else l for l in blanked.split('\n')]


def check_semicolons(scanned):
    """R3: missing semicolons in Java and C-family code. Returns confident
    findings and whether any unconfident candidate was seen. Also returns
    `hazards`, used only by R7: 1-based numbers of candidate lines whose next
    line starts with `(`, `[` or a backtick."""
    lines = split_lines(scanned['blanked'])
    trimmed = [js_trim(l) for l in lines]

    def next_non_blank(index):
        for k in range(index + 1, len(lines)):
            if trimmed[k]:
                return k
        return -1

    def prev_non_blank(index):
        for k in range(index - 1, -1, -1):
            if trimmed[k]:
                return k
        return -1

    stack = []
    findings = []
    hazards = []
    unsure = False

    for index, text in enumerate(lines):
        enclosing = next((b for b in reversed(stack) if b['ch'] == '{'), None)
        in_data_brace = bool(enclosing and enclosing.get('data'))
        last_closer = None  # info about the `(` matched by this line's final `)`
        bare_equals = False

        for col, ch in enumerate(text):
            if ch in OPEN:
                entry = {'ch': ch, 'line': index, 'col': col}
                if ch == '{':
                    before = js_trim(text[:col])
                    prev = prev_non_blank(index)
                    entry['data'] = bool(
                        DATA_BRACE_BEFORE.search(before)
                        or (before == '' and prev != -1 and trimmed[prev].endswith('='))
                        or ENUM_WORD.search(before)
                        or (before == '' and prev != -1 and ENUM_WORD.search(trimmed[prev])))
                stack.append(entry)
            elif ch in CLOSE:
                k = len(stack) - 1
                while k >= 0 and stack[k]['ch'] != CLOSE[ch]:
                    k -= 1
                if k >= 0:
                    opener = stack[k]
                    del stack[k:]
                    if ch == ')':
                        last_closer = {'col': col, 'opener': opener}
            elif is_bare_equals(text, col) and all(b['ch'] == '{' for b in stack):
                bare_equals = True

        line = trimmed[index]
        if not line:
            continue
        last = line[-1]
        ends_increment = line.endswith('++') or line.endswith('--')

        # (a) to (g): is this line a candidate?
        if not CANDIDATE_END.search(last) and not ends_increment:
            continue
        if any(b['ch'] != '{' for b in stack):
            continue
        word = first_word(line)
        if word in BLOCK_WORDS:
            continue
        if (line.startswith('@') or scanned['preprocessor'][index]
                or scanned['starts_in_string'][index]):
            continue
        if index + 1 in scanned['unclosed']:
            continue  # already reported as an unclosed string
        if in_data_brace:
            continue
        following_index = next_non_blank(index)
        if following_index != -1:
            following = trimmed[following_index]
            if following[0] in SKIP_BEFORE:
                continue
            if first_word(following) in CONTINUATION_WORDS:
                continue
        closes_here = None
        if (last == ')' and last_closer
                and last_closer['col'] == len(js_trim_end(text)) - 1):
            closes_here = last_closer['opener']
        if (closes_here and closes_here['line'] < index
                and first_word(trimmed[closes_here['line']]) in BLOCK_WORDS):
            continue

        # (h) and (i): is the candidate confident?
        is_call = False
        if closes_here:
            before = js_trim_end(lines[closes_here['line']][:closes_here['col']])
            is_call = bool(CALL_BEFORE.search(before))
        if (following_index != -1 and trimmed[following_index][0] in HAZARD_START
                and not scanned['starts_in_string'][following_index]
                and not OPEN_ENDED_WORDS.search(line)):
            hazards.append(index + 1)
        shaped = bare_equals or word in STATEMENT_WORDS or ends_increment or is_call
        starts_statement = (following_index == -1
                            or bool(STATEMENT_START.match(trimmed[following_index])))
        if shaped and starts_statement:
            findings.append({'rule': 'R3', 'kind': 'semicolon', 'line': index + 1})
        else:
            unsure = True

    return {'findings': findings, 'unsure': unsure, 'hazards': hazards}


def check_semicolon_habit(scanned):
    """R7: semicolons in JavaScript, where leaving them out is legal. Two cases
    are still worth a hunch.
     - Habit: the code ends nearly all its statements with a semicolon, so the
       few lines that do not are probably slips.
     - Joined lines: a line with no semicolon followed by one starting with
       `(`, `[` or a backtick. JavaScript reads the two as one statement."""
    semi = check_semicolons(scanned)
    missing = [f['line'] for f in semi['findings']]
    ended = sum(1 for l in scanned['blanked'].split('\n') if js_trim_end(l).endswith(';'))
    habit = ended >= HABIT_MIN_LINES and ended / (ended + len(missing)) >= HABIT_SHARE
    lines = set(missing if habit else []) | set(semi['hazards'])
    return [{'rule': 'R7', 'kind': 'semicolon', 'line': line} for line in sorted(lines)]


def brace_language_check(text, config):
    scanned = scan(to_units(text), config)
    findings = list(scanned['findings'])
    bracket = check_brackets(scanned['blanked'])
    if bracket:
        findings.append(bracket)
    semi = check_semicolons(scanned)
    findings.extend(semi['findings'])
    findings.extend(check_condition_assign(scanned['blanked']))
    return {'findings': findings, 'unsure': semi['unsure']}
