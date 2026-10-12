let scores = { ada: 3, grace: 5 }
const best = scores.grace
[scores.ada, scores.grace] = [scores.grace, scores.ada]

console.log(best, scores)
