from .common import LANGUAGES, brace_language_check


def check(text, use_parser=True):
    return brace_language_check(text, LANGUAGES['java'])
