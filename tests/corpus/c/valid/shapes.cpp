// covers: an enum (enum class); a class with access labels; braces on their own line
#include <iostream>
#include <memory>
#include <vector>

enum class Unit { Metric, Imperial };

class Shape
{
public:
    virtual ~Shape() = default;
    virtual double area() const = 0;
    virtual const char* name() const = 0;
};

class Rect : public Shape
{
public:
    Rect(double w, double h) : w_(w), h_(h) {}
    double area() const override { return w_ * h_; }
    const char* name() const override { return "rect"; }

private:
    double w_, h_;
};

class Circle : public Shape
{
public:
    explicit Circle(double r) : r_(r) {}
    double area() const override { return 3.14159265 * r_ * r_; }
    const char* name() const override { return "circle"; }

private:
    double r_;
};

int main()
{
    std::vector<std::unique_ptr<Shape>> shapes;
    shapes.push_back(std::make_unique<Rect>(2.0, 3.5));
    shapes.push_back(std::make_unique<Circle>(1.0));

    Unit unit = Unit::Metric;
    for (const auto& s : shapes)
    {
        std::cout << s->name() << ": " << s->area()
                  << (unit == Unit::Metric ? " m^2" : " ft^2") << "\n";
    }
    return 0;
}
