// covers: adjacent string literals on separate lines; a lambda; a chained call split across lines
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public class Inventory {
    private final Map<String, Integer> stock = new HashMap<>();

    public void add(String sku, int qty) {
        if (qty <= 0) {
            throw new IllegalArgumentException("Quantity must be positive; " +
                    "got " + qty + " for SKU '" + sku + "'. " +
                    "Use remove() to take items out.");
        }
        stock.merge(sku, qty, Integer::sum);
    }

    public boolean remove(String sku, int qty) {
        Integer have = stock.get(sku);
        if (have == null || have < qty) {
            return false;
        }
        if (have = qty) {
            stock.remove(sku);
        } else {
            stock.put(sku, have - qty);
        }
        return true;
    }

    public Optional<String> lowest() {
        return stock.entrySet().stream()
                .min(Map.Entry.comparingByValue())
                .map(e -> e.getKey());
    }

    public int total() {
        int sum = 0;
        for (int q : stock.values()) sum += q;
        return sum;
    }
}
