from .common import (LANGUAGES, to_units, scan, check_brackets, check_condition_assign,
                     check_semicolon_habit)


# There is no JavaScript parser here (the page's rule R6), so this is the page's
# check with useParser: false. use_parser is accepted and ignored.
def check(text, use_parser=True):
    scanned = scan(to_units(text), LANGUAGES['javascript'])
    structural = list(scanned['findings'])
    bracket = check_brackets(scanned['blanked'])
    if bracket:
        structural.append(bracket)
    assign = check_condition_assign(scanned['blanked'])

    findings = structural + assign
    # R7 reads line endings, which mean little once a bracket or string is broken.
    broken = len(structural) > 0 or any(f['kind'] == 'parse' for f in findings)
    if not broken:
        findings.extend(check_semicolon_habit(scanned))
    return {'findings': findings, 'unsure': False}
