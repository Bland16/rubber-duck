// covers: while ((line = r.readLine()) != null)
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;

public class LineCounter {

    public static int countNonBlank(String path) throws IOException {
        int count = 0
        try (BufferedReader r = new BufferedReader(new FileReader(path))) {
            String line;
            while ((line = r.readLine()) != null) {
                if (line.trim().isEmpty()) {
                    continue;
                }
                count++;
            }
        }
        return count;
    }

    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("usage: LineCounter <file>");
            System.exit(1);
        }
        try {
            int n = countNonBlank(args[0]);
            System.out.println(n + " non-blank lines");
        } catch (IOException e) {
            System.err.println("could not read " + args[0] + ": " + e.getMessage());
        }
    }
}
