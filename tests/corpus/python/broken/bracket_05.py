# covers: a conditional expression (two-space indentation)
def transpose(m):
  return [list(row) for row in zip(*m)]


def multiply(a, b):
  if len(a[0]) != len(b):
    raise ValueError("shape mismatch")
  cols = transpose(b)
  return [[sum(x * y for x, y in zip(row, col)) for col in cols] for row in a]


def identity(n):
  return [[1 if r == c else 0 for c in range(n)] for r in range(n)]


def power(m, k):
  result = identity(len(m))
  while k > 0:
    if k % 2 == 1:
      result = multiply(result, m)
    m = multiply(m, m)
    k //= 2
  return result


fib = power([[1, 1], [1, 0], 10)
print(fib[0][1])
for row in transpose([[1, 2, 3], [4, 5, 6]]):
  print(row)
