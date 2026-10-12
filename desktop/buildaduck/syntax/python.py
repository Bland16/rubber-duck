import ast
import re
import textwrap
import warnings

from .common import LANGUAGES, WS, at, to_units, js_trim, scan, check_brackets, is_bare_equals

OPENERS = '([{'
CLOSERS = ')]}'

CONDITION = re.compile(WS + r'*(?:if|elif|while)\b', re.ASCII)
LEAD = re.compile(r'[ \t]*')
# \Z, not $: Python's $ also matches before a final line feed.
BACKSLASH_END = re.compile(r'\\\r?\Z')


def check(text, use_parser=True):
    """use_parser=False is the port of js/syntax/python.js alone; the default
    adds rule P6, Python's own parser."""
    result = heuristics(text)
    if not use_parser:
        return result
    state, line = parse(text)
    findings = result['findings']
    if state == 'ok':
        # Python accepts some mixes of tabs and spaces that are still mistakes.
        findings = [f for f in findings if f['rule'] == 'R5']
    elif state == 'error' and not findings:
        findings = [{'rule': 'P6', 'kind': 'parse', 'line': line}]
    return {'findings': findings, 'unsure': False}


def parse(text):
    """P6. Returns ('ok', None), ('error', line or None) or ('unavailable', None)."""
    if text.startswith('﻿'):
        text = text[1:]
    if '\x00' in text:
        return 'unavailable', None
    try:
        try:
            parse_quietly(text)
        except IndentationError as error:
            if not (error.msg or '').startswith('unexpected indent'):
                raise
            # People paste the inside of a function. This second result stands.
            parse_quietly(textwrap.dedent(text))
    except SyntaxError as error:
        return 'error', error.lineno
    except (ValueError, RecursionError, MemoryError, OverflowError):
        return 'unavailable', None
    return 'ok', None


def parse_quietly(source):
    # ast.parse, not compile: it accepts a bare `return` or `await`.
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        ast.parse(source)


def heuristics(text):
    text = to_units(text)
    scanned = scan(text, LANGUAGES['python'])
    findings = list(scanned['findings'])
    bracket = check_brackets(scanned['blanked'])
    if bracket:
        findings.append(bracket)

    original = text.split('\n')
    lines = scanned['blanked'].split('\n')
    indented = []
    depth = 0
    continued = False

    for index, line in enumerate(lines):
        # Continuation lines (inside brackets or after a backslash) may be
        # indented any way at all, so they are not judged.
        logical_start = depth == 0 and not continued and not scanned['starts_in_string'][index]

        if logical_start:
            condition = CONDITION.match(line)
            if condition and has_bare_equals(line, condition.end()):
                findings.append({'rule': 'R4', 'kind': 'assign', 'line': index + 1})
            if js_trim(line):
                lead = LEAD.match(original[index]).group(0)
                if lead:
                    indented.append({'line': index + 1, 'lead': lead})

        for ch in line:
            if ch in OPENERS:
                depth += 1
            elif ch in CLOSERS and depth > 0:
                depth -= 1
        continued = bool(BACKSLASH_END.search(original[index]))

    indent = check_indent(indented)
    if indent:
        findings.append(indent)
    return {'findings': findings, 'unsure': False}


def has_bare_equals(line, start):
    """A bare `=` outside all brackets, between the keyword and the colon that
    ends the condition."""
    depth = 0
    for i in range(start, len(line)):
        ch = line[i]
        if ch in OPENERS:
            depth += 1
        elif ch in CLOSERS:
            depth -= 1
        elif depth == 0 and ch == ':' and at(line, i + 1) != '=':
            return False
        elif depth == 0 and is_bare_equals(line, i):
            return True
    return False


def check_indent(indented):
    """R5: tabs and spaces mixed, within one line or across the file."""
    mixed = next((l for l in indented if '\t' in l['lead'] and ' ' in l['lead']), None)
    if mixed:
        return {'rule': 'R5', 'kind': 'indent', 'line': mixed['line']}
    if not indented:
        return None
    style = indented[0]['lead'][0]
    other = next((l for l in indented if l['lead'][0] != style), None)
    return {'rule': 'R5', 'kind': 'indent', 'line': other['line']} if other else None
