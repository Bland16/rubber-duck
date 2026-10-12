const queue = []
let running = false

function enqueue(task) {
  queue.push(task)
  if (!running) drain()
}

async function drain() {
  running = true
  while (queue.length) {
    const task = queue.shift()
    await task()
  }
  running = false
}

;[1, 2, 3].forEach((n) => enqueue(async () => console.log(n)))
;(async () => {
  await Promise.resolve()
  enqueue(async () => console.log('done'))
})()

export { enqueue }
