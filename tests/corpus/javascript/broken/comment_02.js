// covers: (none) async functions, try/finally, a Map
const cache = new Map();

async function memoFetch(url, ttlMs = 60_000) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) {
    return hit.data;
  }
  const res = await fetch(url);
  const data = await res.json();
  cache.set(url, { at: Date.now(), data });
  return data;
}

/*
 * Runs the task functions with at most `limit` in flight.
 * Results come back in the original order.
 *
async function runLimited(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const index = next++;
      try {
        results[index] = await tasks[index]();
      } catch (err) {
        results[index] = err;
      }
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(limit, tasks.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

module.exports = { memoFetch, runLimited };
