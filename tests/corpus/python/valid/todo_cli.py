# covers: a walrus operator; dict and set literals; a multi-line call
import json
import sys
from pathlib import Path

STORE = Path.home() / ".todo.json"
COMMANDS = {"add", "done", "list"}


def load():
    if not STORE.exists():
        return []
    return json.loads(STORE.read_text(encoding="utf-8"))


def save(items):
    STORE.write_text(
        json.dumps(items, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def run(command, *args):
    if command not in COMMANDS:
        raise SystemExit(f"unknown command: {command} (try: {', '.join(sorted(COMMANDS))})")
    items = load()
    if command == "add":
        items.append({"text": " ".join(args), "done": False})
    elif command == "done":
        if (index := int(args[0]) - 1) not in range(len(items)):
            raise SystemExit("no such item")
        items[index]["done"] = True
    else:
        for i, item in enumerate(items, start=1):
            mark = "x" if item["done"] else " "
            print(f"{i:>2}. [{mark}] {item['text']}")
    save(items)


if __name__ == "__main__":
    run(*sys.argv[1:] or ["list"])
