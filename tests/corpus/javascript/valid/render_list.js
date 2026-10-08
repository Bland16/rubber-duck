// covers: template literals with nested expressions
function renderList(title, items) {
  const rows = items.map((item, i) => `  <li class="${i % 2 ? 'odd' : 'even'}">${item.name}</li>`);
  return `<section>
  <h2>${title} (${items.length})</h2>
  <ul>
${rows.join('\n')}
  </ul>
  ${items.length === 0 ? `<p class="empty">Nothing in "${title}" yet</p>` : ''}
</section>`;
}

function describe(user) {
  const { name, pets = [] } = user;
  const list = pets.length
    ? `${pets.length} pet${pets.length > 1 ? 's' : ''}: ${pets.map((p) => `"${p}"`).join(', ')}`
    : 'no pets';
  return `${name} has ${list}.`;
}

console.log(renderList('Ducks', [{ name: 'Mallard' }, { name: 'Pekin' }]));
console.log(describe({ name: 'Ana', pets: ['Rex', 'Tom'] }));
console.log(describe({ name: 'Bo' }));
