// covers: a chained call split across lines; a lambda
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class WordStats {
    public static Map<String, Long> countWords(String text) {
        return Arrays.stream(text.split("\\s+"))
                .map(String::toLowerCase)
                .filter(w -> !w.isEmpty())
                .collect(Collectors.groupingBy(w -> w, Collectors.counting()));
    }

    public static List<String> longest(List<String> words, int n) {
        return words.stream()
                .sorted((a, b) -> Integer.compare(b.length(), a.length()))
                .limit(n)
                .collect(Collectors.toList());
    }

    public static void main(String[] args) {
        Map<String, Long> counts = countWords("the quick brown fox jumps over the lazy dog");
        counts.forEach((word, count) -> {
            if (count > 1) {
                System.out.println(word + " x" + count);
            }
        });
    }
}
