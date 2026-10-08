// covers: a lambda; an enum without a body (constants on separate lines); annotations
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

public class EventBus {
    enum Topic {
        STARTED,
        PROGRESS,
        FINISHED
    }

    interface Listener {
        void handle(String payload);
    }

    private final Map<Topic, List<Listener>> listeners = new EnumMap<>(Topic.class);

    void subscribe(Topic topic, Listener l) {
        listeners.computeIfAbsent(topic, t -> new ArrayList<>()).add(l);
    }

    void publish(Topic topic, String payload) {
        for (Listener l : listeners.getOrDefault(topic, List.of())) {
            l.handle(payload);
        }
    }

    public static void main(String[] args) {
        EventBus bus = new EventBus();
        bus.subscribe(Topic.STARTED, p -> System.out.println("started: " + p));
        bus.subscribe(Topic.FINISHED, new Listener() {
            @Override
            public void handle(String payload) {
                System.out.println("done: " + payload);
            }
        });
        bus.publish(Topic.STARTED, "job-1");
        bus.publish(Topic.FINISHED, "job-1");
    }
}
