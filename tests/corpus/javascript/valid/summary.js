const users = [
  { name: 'Ada', active: true, visits: 12 },
  { name: 'Grace', active: false, visits: 7 },
];

const summary = users
  .filter((user) => user.active)
  .map((user) => ({
    label: user.name.toUpperCase(),
    score: user.visits * 2,
  }));

const total = summary.reduce(
  (sum, entry) => sum + entry.score,
  0,
);

const message = total > 20
  ? `busy: ${total}`
  : `quiet: ${total}`;

class Counter {
  count = 0;

  increment() {
    this.count += 1;
    return this;
  }
}

console.log(new Counter().increment().count, message);

export default {
  summary,
  message,
  describe: () => message.trim()
};
