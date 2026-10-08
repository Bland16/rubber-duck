# covers: a multi-line call; dict and set literals; slices
import csv
import io
from datetime import date

SAMPLE = """date,category,amount
2024-01-03,food,12.50
2024-01-03,transit,2.75
2024-01-04,food,8.20
"""


def summarise(rows, skip=frozenset({"refund", "transfer"})):
    totals = {}
    for row in rows:
        category = row["category"]
        if category in skip:
            continue
        totals[category] = totals.get(category, 0.0) + float(row["amount"])
    return totals


def report(text):
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    totals = summarise(rows)
    days = sorted({date.fromisoformat(r["date"]) for r in rows})
    header = "{:<10} {:>8}".format(
        "category",
        "total",
    )
    lines = [header, "-" * len(header)]
    lines += [
        "{:<10} {:>8.2f}".format(name, amount)
        for name, amount in sorted(totals.items(), key=lambda kv: -kv[1])
    ]
    lines.append(f"{days[0]} to {days[-1]}: {len(rows)} rows")
    return "\n".join(lines)


print(report(SAMPLE))
