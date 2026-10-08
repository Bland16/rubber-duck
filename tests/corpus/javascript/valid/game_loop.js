// covers: code written without semicolons; arrow functions
const canvas = document.querySelector('canvas')
const ctx = canvas.getContext('2d')

const ball = { x: 50, y: 50, vx: 3, vy: 2, r: 8 }
const keys = new Set()
let paddleX = canvas.width / 2
let score = 0

addEventListener('keydown', e => keys.add(e.key))
addEventListener('keyup', e => keys.delete(e.key))

function update() {
  if (keys.has('ArrowLeft')) paddleX -= 6
  if (keys.has('ArrowRight')) paddleX += 6
  ball.x += ball.vx
  ball.y += ball.vy
  if (ball.x < ball.r || ball.x > canvas.width - ball.r) ball.vx *= -1
  if (ball.y < ball.r) ball.vy *= -1
  const onPaddle = Math.abs(ball.x - paddleX) < 40
  if (ball.y > canvas.height - 20 && onPaddle && ball.vy > 0) {
    ball.vy *= -1
    score++
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(paddleX - 40, canvas.height - 12, 80, 6)
  ctx.fillText(`Score: ${score}`, 10, 16)
}

function frame() {
  update()
  draw()
  requestAnimationFrame(frame)
}

frame()
