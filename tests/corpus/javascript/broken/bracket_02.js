// covers: (none) a class with private fields and a getter
class TodoList {
  #items = [];
  #nextId = 1;

  add(text) {
    const item = { id: this.#nextId++, text, done: false };
    this.#items.push(item);
    return item.id;
  }

  toggle(id) {
    const item = this.#items.find((it) => it.id === id);
    if (!item) {
      throw new RangeError(`no item with id ${id}`);
    item.done = !item.done;
  }

  get remaining() {
    return this.#items.filter((it) => !it.done).length;
  }

  static from(texts) {
    const list = new TodoList();
    texts.forEach((t) => list.add(t));
    return list;
  }

  *[Symbol.iterator]() {
    yield* this.#items;
  }
}

const list = TodoList.from(['feed ducks', 'write tests']);
list.toggle(1);
for (const item of list) {
  console.log(`${item.done ? '[x]' : '[ ]'} ${item.text}`);
}
console.log(list.remaining + ' left');
