// covers: a class with access labels
#include <iostream>
#include <stdexcept>
#include <string>
#include <utility>

class Account {
public:
    explicit Account(std::string owner, double opening = 0.0)
        : owner_(std::move(owner)), balance_(opening) {}

    void deposit(double amount) {
        if (amount <= 0)
            throw std::invalid_argument("deposit must be positive);
        balance_ += amount;
    }

    bool withdraw(double amount) {
        if (amount > balance_)
            return false;
        balance_ -= amount;
        return true;
    }

    double balance() const { return balance_; }
    const std::string& owner() const { return owner_; }

protected:
    void applyFee(double fee) { balance_ -= fee; }

private:
    std::string owner_;
    double balance_;
};

int main() {
    Account acct("Sam", 100.0);
    acct.deposit(25.5);
    if (!acct.withdraw(500))
        std::cout << "insufficient funds\n";
    std::cout << acct.owner() << ": " << acct.balance() << std::endl;
    return 0;
}
