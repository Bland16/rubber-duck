import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scan, LANGUAGES } from '../js/syntax/common.js';
import { checkCode, guessLanguage, MAX_PASTE } from '../js/syntax/index.js';

const kinds = (text, language) => checkCode(text, language).findings.map((f) => `${f.kind}@${f.line}`);
const clean = (text, language) => assert.deepEqual(kinds(text, language), [], text);
const java = (body) => `class A {\n  void f() {\n${body}\n  }\n}\n`; // body starts on line 3

// ── Scanner ────────────────────────────────────────────────────────────────

const sameShape = (text, blanked) => {
  assert.equal(blanked.length, text.length);
  assert.deepEqual([...blanked].map((c, i) => (c === '\n' ? i : -1)).filter((i) => i >= 0),
    [...text].map((c, i) => (c === '\n' ? i : -1)).filter((i) => i >= 0));
};

test('scanner blanks strings and comments and keeps the shape', () => {
  const samples = {
    java: 'String s = "a{(\\"x"; // tail ) }\n/* block\n ( */ char c = \'}\';\nString t = """\n  text { block (\n  """;\n',
    c: 'char *s = "a{(\\"x"; // tail ) }\n/* block\n ( */ char c = \'}\';\nauto r = R"tag(raw ) " { text)tag";\n',
    javascript: 'const s = "a{(\\"x"; // tail ) }\n/* block\n ( */ const t = `one ${ {a: [1]}.a } two (`;\n',
    python: 's = "a{(\\"x"  # tail ) }\nt = """doc (\n  [ string\n"""\nu = \'}\'\n',
  };
  for (const [language, text] of Object.entries(samples)) {
    const { blanked, findings } = scan(text, LANGUAGES[language]);
    sameShape(text, blanked);
    assert.deepEqual(findings, [], language);
    const structural = blanked.replace(/[^()[\]{}]/g, '');
    assert.ok(!/[\])}]/.test(structural.replace(/\[1\]|\{\}|\(\)|\{\{\[\]\}\}/g, '')) || language === 'javascript', language);
    clean(text, language === 'c' ? 'c' : language);
  }
});

test('scanner keeps string delimiters and marks lines inside multi-line strings', () => {
  const text = 'x = """\n  inside\n"""\ny = "s"\n';
  const result = scan(text, LANGUAGES.python);
  assert.equal(result.blanked, 'x = """\n        \n"""\ny = " "\n');
  assert.deepEqual(result.startsInString.slice(0, 4), [false, true, true, false]);
});

test('a backslash continues a string or a preprocessor line', () => {
  clean('const char *s = "one \\\ntwo";\n', 'c');
  clean('#define SWAP(a, b) { \\\n  int t = a; \\\n  a = b; b = t; }\n#error don\'t do that\nint x = 1;\n', 'c');
  const scanned = scan('#define A \\\n  1\nint x;\n', LANGUAGES.c);
  assert.deepEqual(scanned.preprocessor.slice(0, 3), [true, true, false]);
});

test('C++ digit separators are not character literals', () => {
  clean('int big = 1\'000\'000;\nchar c = \'a\';\n', 'c');
});

// ── R1 brackets ────────────────────────────────────────────────────────────

test('R1: stray closer, mismatch and unclosed opener', () => {
  assert.deepEqual(kinds('x = 1\ny = 2)\n', 'python'), ['bracket@2']);
  assert.deepEqual(kinds('x = [1, 2)\n', 'python'), ['bracket@1']);
  assert.deepEqual(kinds('x = (1,\n     2\ny = 3\n', 'python'), ['bracket@1']);
  assert.deepEqual(kinds('def f(a):\n    return {"k": [a, (1, 2)]}\n', 'python'), []);
});

test('R1 reports only the first problem', () => {
  assert.deepEqual(kinds('a = 1)\nb = 2]\n', 'python'), ['bracket@1']);
});

// ── R2 strings and comments ────────────────────────────────────────────────

test('R2a: an unclosed string, per language', () => {
  assert.ok(kinds(java('    String s = "open;'), 'java').includes('string@3'));
  assert.ok(kinds('int main() {\n  puts("open);\n  return 0;\n}\n', 'c').includes('string@2'));
  assert.ok(kinds('const s = "open;\nconst t = 1;\n', 'javascript').includes('string@1'));
  assert.ok(kinds('s = "open\nt = 1\n', 'python').includes('string@1'));
  assert.ok(kinds('s = """open\nt = 1\n', 'python').includes('string@1'));
  assert.ok(kinds('const s = `open\nconst t = 1;\n', 'javascript').includes('string@1'));
});

test('R2a reports only the first unclosed string', () => {
  assert.deepEqual(kinds('s = "one\nt = "two\n', 'python'), ['string@1']);
});

test('R2b: an unclosed block comment', () => {
  assert.deepEqual(kinds(java('    int x = 1; /* never closed'), 'java').filter((k) => k.startsWith('comment')), ['comment@3']);
  assert.ok(kinds('int x = 1;\n/* open\nint y = 2;\n', 'c').includes('comment@2'));
  assert.ok(kinds('let x = 1;\n/* open\nlet y = 2;\n', 'javascript').includes('comment@2'));
  clean(java('    int x = 1; /* closed */'), 'java');
});

// ── R3 semicolons ──────────────────────────────────────────────────────────

test('R3: a plain missing semicolon, per language', () => {
  assert.deepEqual(kinds(java('    int x = 5\n    int y = 6;'), 'java'), ['semicolon@3']);
  assert.deepEqual(kinds('int main(void) {\n  int x = 5\n  return x;\n}\n', 'c'), ['semicolon@2']);
});

test('R3 (a): a line must end like a statement to be a candidate', () => {
  clean(java('    int[] xs = {\n      1, 2\n    };\n    foo(a ->\n      a);'), 'java');
});

test('R3 (b): a line inside open parentheses is not a candidate', () => {
  clean(java('    foo(a,\n        b\n    );'), 'java');
});

test('R3 (c): block keywords are never flagged', () => {
  clean(java('    if (x)\n      y();\n    else\n      z();\n    for (int i = 0; i < 3; i++)\n      y();\n    do\n      y();\n    while (x);'), 'java');
  clean('struct point\n{\n  int x;\n};\n', 'c');
});

test('R3 (d): annotations, preprocessor lines and text blocks', () => {
  clean('class A {\n  @Override\n  public String toString() {\n    return "a";\n  }\n}\n', 'java');
  clean('#include <stdio.h>\n#define N 10\nint x = N;\n', 'c');
  clean(java('    String s = """\n      int x = 5\n      """;'), 'java');
});

test('R3 (e): enums and initialisers', () => {
  clean('public enum Color {\n  RED,\n  BLUE\n}\n', 'java');
  clean('typedef enum {\n  RED,\n  BLUE\n} color;\n', 'c');
  clean('enum color\n{\n  RED,\n  BLUE\n};\n', 'c');
  clean(java('    int[][] grid = {\n      {1, 2},\n      {3, 4}\n    };'), 'java');
});

test('R3 (f): the next line continues the statement', () => {
  clean(java('    String s = builder\n      .append(1)\n      .toString();\n    int t = a\n      + b;\n    String u = "a"\n      "b";'), 'java');
  clean('class A extends B\n    implements C {\n}\n', 'java');
  clean('class A {\n  void f() throws E\n  {\n  }\n}\n', 'java');
});

test('R3 (g): a wrapped condition is not a statement', () => {
  clean(java('    if (a &&\n        b)\n      go();'), 'java');
});

test('R3 (h): each confident statement shape', () => {
  const shaped = ['x = 5', 'return x', 'i++', 'run(x)', 'obj.run(x)', 'break'];
  for (const line of shaped) {
    assert.deepEqual(kinds(java(`    ${line}\n    done();`), 'java'), ['semicolon@3'], line);
  }
});

test('R3: a candidate that fails (h) or (i) is unsure, not a finding', () => {
  const noShape = checkCode(java('    int x\n    done();'), 'java');
  assert.deepEqual(noShape.findings, []);
  assert.equal(noShape.unsure, true);
  const noNextStatement = checkCode(java('    x = 5\n    (y).run();'), 'java');
  assert.deepEqual(noNextStatement.findings, []);
  assert.equal(noNextStatement.unsure, true);
  assert.equal(checkCode(java('    int x = 5;'), 'java').unsure, false);
});

// ── R4 assignment in a condition ───────────────────────────────────────────

test('R4: a bare = in a condition, per language', () => {
  assert.deepEqual(kinds(java('    if (x = 5) { }'), 'java'), ['assign@3']);
  assert.deepEqual(kinds('int f(int x) {\n  while (x = 5) { }\n  return x;\n}\n', 'c'), ['assign@2']);
  assert.deepEqual(kinds('if (x = 5) { go(); }\n', 'javascript'), ['assign@1']);
  assert.deepEqual(kinds('if x = 5:\n    pass\n', 'python'), ['assign@1']);
  assert.deepEqual(kinds('while x = 5:\n    pass\n', 'python'), ['assign@1']);
});

test('R4: comparison and compound operators are not assignments', () => {
  for (const op of ['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']) {
    clean(java(`    if (x ${op} 5) { }`), 'java');
  }
  clean('if (xs.some((x) => x > 1)) { go(); }\nif ((a ??= 1) && (b ||= 2) && (c &&= 3) && (d **= 2) && (e >>>= 1)) { go(); }\n', 'javascript');
  clean('if x == 5 and y != 6 and z <= 7 and w >= 8:\n    pass\nif (n := len(xs)) > 3:\n    pass\nif n := len(xs):\n    pass\n', 'python');
});

test('R4: a nested assignment idiom is not flagged', () => {
  clean('int main(void) {\n  int c;\n  while ((c = getchar()) != EOF) { }\n  return 0;\n}\n', 'c');
  clean(java('    while ((line = r.readLine()) != null) { }'), 'java');
});

test('R4: Python keyword arguments, slices and conditional expressions', () => {
  clean('if foo(key=1):\n    pass\n', 'python');
  clean('if x: y = d[1:2]\n', 'python');
  clean('y = a if b else c\n', 'python');
  clean('while not done(timeout=5):\n    pass\n', 'python');
});

// ── R5 indentation ─────────────────────────────────────────────────────────

test('R5: tabs and spaces mixed', () => {
  assert.deepEqual(kinds('def f():\n \tpass\n', 'python'), ['indent@2']);
  assert.deepEqual(kinds('def f():\n    a = 1\n\tb = 2\n', 'python'), ['indent@3']);
  clean('def f():\n\ta = 1\n\tif a:\n\t\tb = 2\n', 'python');
  clean('def f():\n    a = 1\n    if a:\n        b = 2\n', 'python');
});

test('R5: indentation inside a docstring or a bracketed continuation is ignored', () => {
  clean('def f():\n    """Doc.\n\tOdd line.\n    """\n    return 1\n', 'python');
  clean('def f():\n\tx = g(1,\n\t      2)\n\treturn x\n', 'python');
});

// ── R6 and combining ───────────────────────────────────────────────────────

test('R6: valid module syntax parses', () => {
  clean('import a from "x";\nimport {\n  b,\n  c\n} from "y";\nimport "side";\nconst d = await a(b, c);\nexport default function () { return d; }\nexport { d };\nexport * from "z";\nexport const e = 1;\n', 'javascript');
  clean('const m = await import("x");\nexport default class {}\n', 'javascript');
});

test('combining: R6 passes, so bracket and string findings are dropped', () => {
  clean('const r = /[(]"/;\nconst s = r.test("x");\n', 'javascript');
  assert.deepEqual(kinds('const r = /[(]"/;\nif (r = 2) { go(); }\n', 'javascript'), ['assign@2']);
});

test('combining: R6 fails and a structural rule found the line', () => {
  assert.deepEqual(kinds('function f() {\n  return (1;\n}\nif (a = 1) {}\n', 'javascript'), ['bracket@3', 'assign@4']);
});

test('combining: R6 fails with nothing structural', () => {
  const result = checkCode('let x = ;\nif (x = 2) {}\n', 'javascript');
  assert.deepEqual(result.findings, [
    { rule: 'R6', kind: 'parse', line: null },
    { rule: 'R4', kind: 'assign', line: 2 },
  ]);
});

test('combining: R6 unavailable keeps structural findings', () => {
  assert.deepEqual(kinds('const u = import.meta.url;\nfunction f( {\n}\n', 'javascript'), ['bracket@2']);
  clean('const u = import.meta.url;\nconst s = "import.meta";\n', 'javascript');
});

test('findings are ordered by kind, then line', () => {
  const text = java('    if (a = 1) { }\n    int x = 5\n    int y = 6\n    done();\n    String s = "open;');
  assert.deepEqual(kinds(text, 'java'), ['string@7', 'semicolon@4', 'semicolon@5', 'assign@3']);
});

// ── Language guess and limits ──────────────────────────────────────────────

test('guessLanguage', () => {
  const all = ['java', 'javascript', 'python', 'c'];
  assert.equal(guessLanguage('def f(x):\n    return x\n', all), 'python');
  assert.equal(guessLanguage('public class A { void f() { System.out.println(1); } }', all), 'java');
  assert.equal(guessLanguage('#include <stdio.h>\nint main(void) { printf("x"); }', all), 'c');
  assert.equal(guessLanguage('const f = () => console.log(1);', all), 'javascript');
  assert.equal(guessLanguage('x', all), 'java');
  assert.equal(guessLanguage('x', ['python', 'c']), 'python');
  assert.equal(guessLanguage('def f(x):\n    return x\n', ['java', 'c']), 'java');
  assert.equal(guessLanguage('function f() {}\ndef g():\n', ['python', 'javascript']), 'python');
});

test('checkCode limits', () => {
  assert.deepEqual(checkCode('', 'java'), { status: 'empty', findings: [], unsure: false });
  assert.equal(checkCode('  \n\t ', 'python').status, 'empty');
  assert.equal(checkCode('x'.repeat(MAX_PASTE), 'python').status, 'ok');
  assert.deepEqual(checkCode('x'.repeat(MAX_PASTE + 1), 'python'), { status: 'too-long', findings: [], unsure: false });
});
