# covers: slices
def chunks(items, size):
    return [items[i:i + size] for i in range(0, len(items), size]


def is_palindrome(text):
    cleaned = [ch.lower() for ch in text if ch.isalnum()]
    return cleaned == cleaned[::-1]


def parse_int(text):
    text = text.strip()
    if text[:2] in ("0x", "0X"):
        return int(text[2:], 16)
    if text[-1:] == "h":
        return int(text[:-1], 16)
    return int(text)


def rotate(seq, n):
    n %= len(seq)
    return seq[n:] + seq[:n]


grid = [[r * 3 + c for c in range(3)] for r in range(3)]
print(chunks(list(range(10)), 4))
print(is_palindrome("A man, a plan, a canal: Panama"))
print(parse_int("0x1F"), parse_int("ffh"), parse_int("42"))
print(rotate("abcdef", 2), [row[1:] for row in grid[:2]])
