// covers: annotations
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public class Task implements Comparable<Task> {
    private final String title;
    private final int priority;

    public Task(String title, int priority) {
        this.title = Objects.requireNonNull(title);
        this.priority = priority;
    }

    @Deprecated
    public String getName() {
        return title;
    }

    @Override
    public int compareTo(Task other) {
        return Integer.compare(priority, other.priority);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Task)) return false;
        Task t = (Task) o;
        return priority == t.priority && title.equals(t.title);
    }

    @Override
    public int hashCode() {
        return Objects.hash(title, priority);
    }

    @SuppressWarnings("unchecked")
    public static <T> List<T> copyOf(List<? extends T> src) {
        return new ArrayList<>((List<T>) src);
    }

    @Override public String toString() { return title + " (" + priority + ")"; }
}
