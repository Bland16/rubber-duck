// covers: strings and comments containing brackets, quotes and semicolons
import java.util.ArrayList;
import java.util.List;

public class CsvLine {
    /* Splits one line of CSV; handles "quoted, fields" and doubled quotes ("").
     * Does not handle embedded newlines (yet); see issue #12 { low priority }.
     */
    public static List<String> split(String line) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                // a doubled quote inside quotes means a literal '"'
                if (quoted && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cur.append('"');
                    i++;
                } else {
                    quoted = !quoted;
                }
            } else if (ch == ',' && !quoted) {
                out.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(ch);
            }
        }
        out.add(cur.toString());
        return out;
    }

    public static void main(String[] args) {
        String sample = "id;name,\"Smith, J. (jr)\",\"say \"\"hi\"\"\",[x]{y}";
        System.out.println(split(sample)); // prints 4 fields; not 5 :)
        char open = '(', close = ')', quote = '\'';
        System.out.println("" + open + close + quote + ";");
    }
}
