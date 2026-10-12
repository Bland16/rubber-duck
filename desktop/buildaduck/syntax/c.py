from .common import LANGUAGES, brace_language_check


# C and C++.
def check(text, use_parser=True):
    return brace_language_check(text, LANGUAGES['c'])
