# covers: a walrus operator
import re
import sys

PATTERN = re.compile(r"(\w+)\s*=\s*(.+)")


def read_settings(lines):
    settings = {}
    for raw in lines:
        if (line := raw.strip()) and not line.startswith("#"):
            if m := PATTERN.match(line):
            	settings[m.group(1)] = m.group(2)
            else:
                print(f"skipping: {line!r}", file=sys.stderr)
    return settings


def read_chunks(stream, size=1024):
    total = 0
    while chunk := stream.read(size):
        total += len(chunk)
    return total


if __name__ == "__main__":
    sample = ["# comment", "name = duck", "", "colour = yellow", "???"]
    print(read_settings(sample))
    if (n := len(sample)) > 3:
        print(f"{n} lines")
