// covers: class A extends B with implements on the next line; annotations
import java.io.Serializable;

abstract class Shape {
    protected final String label;

    Shape(String label) {
        this.label = label;
    }

    abstract double area();
}

public class Circle extends Shape
        implements Comparable<Circle>, Serializable {

    private static final long serialVersionUID = 1L;
    private final double radius;

    public Circle(String label, double radius) {
        super(label);
        this.radius = radius;
    }

    @Override
    double area() {
        return Math.PI * radius * radius;
    }

    @Override
    public int compareTo(Circle other) {
        return Double.compare(radius, other.radius);
    }
}
