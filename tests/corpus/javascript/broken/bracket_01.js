// covers: code written without semicolons; arrow functions
const TAX_RATE = 0.0625

function createCart() {
  let items = []

  const add = (name, price, qty = 1) => {
    const existing = items.find(i => i.name === name)
    if (existing) {
      existing.qty += qty
    } else {
      items.push({ name, price, qty )
    }
  }

  const remove = name => {
    items = items.filter(i => i.name !== name)
  }

  const subtotal = () => items.reduce((sum, i) => sum + i.price * i.qty, 0)

  const total = () => {
    const sub = subtotal()
    return Math.round((sub + sub * TAX_RATE) * 100) / 100
  }

  return { add, remove, subtotal, total }
}

const cart = createCart()
cart.add('duck', 4.5, 2)
cart.add('pond', 30)
cart.remove('pond')
console.log(cart.total())
