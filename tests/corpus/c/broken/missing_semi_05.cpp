// covers: (none) namespace, operator overloads, a lambda
#include <algorithm>
#include <cmath>
#include <iostream>
#include <vector>

namespace geo {

struct Vec2 {
    double x = 0, y = 0;

    Vec2 operator+(const Vec2& o) const { return {x + o.x, y + o.y}; }
    Vec2 operator*(double k) const { return {x * k, y * k}; }
    double length() const { return std::sqrt(x * x + y * y); }
};

std::ostream& operator<<(std::ostream& os, const Vec2& v) {
    return os << '(' << v.x << ", " << v.y << ')';
}

}  // namespace geo

int main() {
    using geo::Vec2;
    std::vector<Vec2> pts = {{3, 4}, {1, 1}, {-6, 8}};

    std::sort(pts.begin(), pts.end(), [](const Vec2& a, const Vec2& b) {
        return a.length() < b.length()
    });

    Vec2 sum;
    for (const auto& p : pts)
        sum = sum + p;

    std::cout << "sum = " << sum << ", farthest = " << pts.back() << '\n';
    return 0;
}
