// covers: a regular-expression literal containing a bracket and a quote; object literals across lines
const rules = {
  username: /^[a-z][a-z0-9_]{2,15}$/i,
  quoted: /^"[^"]*"$/,
  phone: /^\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}$/,
};

const messages = {
  username: 'Use 3-16 letters, digits or "_"; start with a letter.',
  quoted: 'Wrap the value in "double quotes".',
  phone: "That doesn't look like a phone number.",
};

function validate(form) {
  const errors = {};
  for (const [field, pattern] of Object.entries(rules)) {
    const value = form?.[field] ?? '';
    if (!pattern.test(value.trim())) {
      errors[field] = messages[field];
    }
  }
  return Object.keys(errors).length ? errors : null;
}

console.log(validate({ username: 'duck_01', quoted: '"hi"', phone: '(617) 555-0100' }));
console.log(validate({ username: '1duck' }));
