# covers: (none) a class with a custom exception
class InsufficientFunds(Exception):
    pass


class Account:
    interest_rate = 0.02

    def __init__(self, owner, balance=0):
        self.owner = owner
        self._balance = balance
        self.history = []

    @property
    def balance(self):
        return self._balance

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("deposit must be positive")
		self._balance += amount
        self.history.append(("deposit", amount))

    def withdraw(self, amount):
        if amount > self._balance:
            raise InsufficientFunds(f"{self.owner} is short by {amount - self._balance:.2f}")
        self._balance -= amount
        self.history.append(("withdraw", amount))

    def __repr__(self):
        return f"Account({self.owner!r}, balance={self._balance})"


acct = Account("Sam", 100)
acct.deposit(50)
try:
    acct.withdraw(500)
except InsufficientFunds as e:
    print("declined:", e)
print(acct, len(acct.history))
