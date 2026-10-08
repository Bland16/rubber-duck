// covers: a template; a class with access labels
#include <array>
#include <cstddef>
#include <iostream>

template <typename T, std::size_t N>
class RingBuffer {
public:
    bool push(const T& value) {
        if (count_ == N) return false;
        data_[(head_ + count_) % N] = value;
        ++count_;
        return true;
    }

    bool pop(T& out) {
        if (count_ == 0) return false;
        out = data_[head_];
        head_ = (head_ + 1) % N;
        --count_;
        return true;
    }

    std::size_t size() const { return count_; }

private:
    std::array<T, N> data_{};
    std::size_t head_ = 0;
    std::size_t count_ = 0;
};

template <typename T>
T clamp(T value, T lo, T hi)
{
    return value < lo ? lo : (value > hi ? hi : value);
}

int main() {
    RingBuffer<int, 4> rb;
    for (int i = 0; i < 6; ++i)
        rb.push(clamp(i * 10, 0, 35));
    int v;
    while (rb.pop(v))
        std::cout << v << ' ';
    std::cout << '\n';
}
