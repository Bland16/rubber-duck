# covers: a docstring with odd indentation
import textwrap


def usage():
    """Print usage.

usage: duck [-v] FILE
        FILE    path to read
	  -v      verbose (this line starts with a tab)
    """
    print(textwrap.dedent(usage.__doc__))


class Table:
    """A tiny text table.

          Example:
       +----+----+
       | a  | b  |
       +----+----+
    """

    def __init__(self, rows):
        self.rows = rows

    def render(self):
        '''Render rows.
  Each row becomes: | cell | cell |
        '''
	lines = []
        for row in self.rows:
            lines.append("| " + " | ".join(str(c) for c in row) + " |")
        return "\n".join(lines)


if __name__ == "__main__":
    usage()
    print(Table([[1, 2], [3, 4]]).render())
