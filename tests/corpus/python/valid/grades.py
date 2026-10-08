# covers: a conditional expression; dict literals
def letter(score):
    if score >= 90:
        return "A"
    elif score >= 80:
        return "B"
    elif score >= 70:
        return "C"
    return "F"


def describe(name, scores):
    average = sum(scores) / len(scores) if scores else 0.0
    status = "passing" if average >= 70 else "failing"
    plural = "" if len(scores) == 1 else "s"
    return f"{name}: {average:.1f} ({letter(average)}), {status}, {len(scores)} score{plural}"


students = {
    "Ada": [95, 88, 92],
    "Linus": [72, 65],
    "Grace": [],
}

for name, scores in students.items():
    print(describe(name, scores))

best = max(students, key=lambda n: sum(students[n]) / len(students[n]) if students[n] else 0)
print("top:", best)
