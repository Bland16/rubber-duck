# covers: dict and set literals; keyword arguments in an if condition
PRICES = {
    "apple": 0.50,
    "bread": 2.25,
    "cheese": 4.75,
    "milk": 1.99,
}

PERISHABLE = {"bread", "cheese", "milk"}
VOWELS = {"a", "e", "i", "o", "u"}


def restock_list(stock, minimum=5):
    low = {name for name, qty in stock.items() if qty < minimum}
    urgent = low & PERISHABLE
    return {"urgent": sorted(urgent), "later": sorted(low - urgent)}


def order_total(order):
    unknown = set(order) - set(PRICES)
    if unknown:
        raise KeyError(f"no price for: {', '.join(sorted(unknown))}")
    if max(order.values(), default=0) > 100:
        raise ValueError("bulk orders need approval")
    return sum(PRICES[name] * qty for name, qty in order.items())


stock = {"apple": 12, "bread": 2, "cheese": 0, "milk": 9}
print(restock_list(stock))
print(order_total({"apple": 4, "milk": 1}))
print({word[0] for word in PRICES if word[0] in VOWELS}, {})
