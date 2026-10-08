// covers: a regular-expression literal containing a bracket and a quote
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/['"()[\]{}]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseAttribute(text) {
  const match = /(\w+)=["']([^"']*)["']/.exec(text);
  if (!match) {
    return null;
  }
  return { name: match[1], value: match[2] };
}

function stripComments(line) {
  return line.replace(/\/\/.*$/, '').trimEnd();
}

console.log(slugify("Don't Panic: A Guide (2nd ed.)"));
console.log(parseAttribute('class="big duck"'));
console.log(stripComments('let x = 1; // counter'));
