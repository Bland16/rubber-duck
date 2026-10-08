// covers: an expression split before an operator; adjacent string literals on separate lines
public class Invoice {
    private final double subtotal;
    private final double taxRate;
    private final double shipping;
    private final double discount;

    public Invoice(double subtotal, double taxRate, double shipping, double discount) {
        this.subtotal = subtotal;
        this.taxRate = taxRate;
        this.shipping = shipping;
        this.discount = discount;
    }

    public double total() {
        double total = subtotal
                + subtotal * taxRate
                + shipping
                - discount;
        return Math.max(total, 0.0);
    }

    public boolean qualifiesForFreeShipping() {
        return subtotal > 50.0
                && discount == 0.0
                || subtotal > 100.0;
    }

    public String summary() {
        String message = "Invoice total: " + total() + "\n"
                + "Thank you for your order. "
                + "Please keep this receipt for your records.";
        return message;
    }
}
