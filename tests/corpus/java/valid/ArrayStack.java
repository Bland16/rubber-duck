// covers: (none) a small generic class
import java.util.Arrays;
import java.util.EmptyStackException;

public class ArrayStack<T> {
    private Object[] items = new Object[8];
    private int size;

    public void push(T item) {
        if (size == items.length) {
            items = Arrays.copyOf(items, size * 2);
        }
        items[size++] = item;
    }

    @SuppressWarnings("unchecked")
    public T pop() {
        if (size == 0) {
            throw new EmptyStackException();
        }
        T top = (T) items[--size];
        items[size] = null;
        return top;
    }

    public boolean isEmpty() {
        return size == 0;
    }

    public int size() {
        return size;
    }
}
