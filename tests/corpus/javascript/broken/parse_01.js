// covers: (none) plain functions, loops and a switch
function mean(values) {
  if (values.length === 0) return NaN;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum / ;
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stddev(values) {
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}

function summarize(values, kind) {
  switch (kind) {
    case 'mean':
      return mean(values);
    case 'median':
      return median(values);
    case 'spread':
      return stddev(values);
    default:
      throw new Error('unknown summary: ' + kind);
  }
}

const data = [4, 8, 15, 16, 23, 42];
console.log(summarize(data, 'mean'), summarize(data, 'median'), summarize(data, 'spread').toFixed(2));
