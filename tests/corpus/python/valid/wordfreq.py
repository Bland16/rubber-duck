# covers: slices; a conditional expression (indented with tabs)
import sys
from collections import Counter


def words(path):
	with open(path, encoding="utf-8") as f:
		for line in f:
			for word in line.lower().split():
				word = word.strip(".,;:!?\"'()[]")
				if word:
					yield word


def main():
	if len(sys.argv) < 2:
		print("usage: wordfreq.py FILE [N]")
		return 1
	limit = int(sys.argv[2]) if len(sys.argv) > 2 else 10
	try:
		counts = Counter(words(sys.argv[1]))
	except OSError as err:
		print(f"cannot read {sys.argv[1]}: {err}")
		return 1
	width = max((len(w) for w, _ in counts.most_common(limit)), default=0)
	for word, n in counts.most_common()[:limit]:
		print(f"{word:<{width}}  {n:>5}  {'#' * min(n, 40)}")
	return 0


if __name__ == "__main__":
	sys.exit(main())
