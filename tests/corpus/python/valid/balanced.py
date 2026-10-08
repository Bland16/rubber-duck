# covers: strings and comments containing brackets, quotes and colons
OPENERS = "([{"
CLOSERS = ")]}"
PAIRS = {")": "(", "]": "[", "}": "{"}


def balanced(text):
    """Return True if every ( [ { has its partner: "(]" is not balanced."""
    stack = []
    for ch in text:
        if ch in OPENERS:      # one of: ( [ {
            stack.append(ch)
        elif ch in CLOSERS:    # one of: ) ] }  -- note: order matters
            if not stack or stack.pop() != PAIRS[ch]:
                return False
    return not stack


def quote(text):
    # 'single' is the default; switch to "double" if the text has a '
    if "'" in text and '"' not in text:
        return '"' + text + '"'
    return "'" + text.replace("'", "\\'") + "'"


tests = ["f(a[0], {'k': 1})", "if x: (", 'say "hi":)', "it's: [ok]"]
for t in tests:
    print(f"{quote(t):30} -> {balanced(t)}")
print("time: 12:30", 'key: "value"', "#not a comment")
