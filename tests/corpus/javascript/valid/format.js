// covers: template literals with nested expressions; arrow functions
/**
 * Formats a byte count, e.g. 1536 -> "1.5 KB".
 * @param {number} bytes
 * @returns {string}
 */
const formatBytes = (bytes) => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${i === 0 ? bytes : bytes.toFixed(1)} ${units[i]}`;
};

/* Turns {a: 1, b: [2, 3]} into "a=1; b=[2,3]" (handy for logs; don't parse it). */
const inline = (obj) =>
  Object.entries(obj)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? `[${v.join(',')}]` : v}`)
    .join('; ');

const quote = (s) => `"${String(s).replace(/"/g, '\\"')}"`;

console.log(formatBytes(1536), formatBytes(12));
console.log(inline({ a: 1, b: [2, 3] }));
console.log(quote('say "hi"'));
