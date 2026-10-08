// covers: an enum without a body
public class TrafficLight {
    enum Color { RED, YELLOW, GREEN }

    private Color current = Color.RED;
    private int ticks = 0;

    public void tick() {
        ticks++;
        switch (current) {
            case RED:
                if (ticks >= 30) advance(Color.GREEN);
                break;
            case GREEN:
                if (ticks >= 25) advance(Color.YELLOW);
                break;
            case YELLOW:
                if (ticks >= 5) advance(Color.RED);
                break;
            default:
                throw new IllegalStateException("unknown color");
        }
    }

    private void advance(Color next) {
        current = next;
        ticks = 0;
    }

    public Color getCurrent() {
        return current;
    }
}
