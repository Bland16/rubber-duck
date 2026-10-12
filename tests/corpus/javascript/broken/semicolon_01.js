const TAX = 0.2;
const items = [];

function addItem(name, price) {
  items.push({ name, price });
  return items.length;
}

function total() {
  let sum = 0;
  for (const item of items) {
    sum += item.price;
  }
  const withTax = sum * (1 + TAX)
  return Math.round(withTax * 100) / 100;
}

addItem('pen', 2.5);
console.log(total());
