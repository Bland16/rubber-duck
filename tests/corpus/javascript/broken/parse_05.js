// covers: top-level await; a module with import
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = 'https://example.com/api';

async funtion getJson(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(250 * attempt);
    }
  }
}

const posts = await getJson(`${BASE}/posts?limit=5`);
const authors = await Promise.all(
  posts.map((p) => getJson(`${BASE}/users/${p.authorId}`))
);

for (const [i, post] of posts.entries()) {
  console.log(`${post.title} by ${authors[i].name}`);
}
