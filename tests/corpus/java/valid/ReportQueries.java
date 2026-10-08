// covers: a text block
public class ReportQueries {
    static final String TOP_CUSTOMERS = """
            SELECT c.name, SUM(o.total) AS spent
            FROM customers c
            JOIN orders o ON o.customer_id = c.id
            WHERE o.status = 'paid'
            GROUP BY c.name
            ORDER BY spent DESC
            LIMIT ?;
            """;

    static String html(String title, String body) {
        String page = """
            <html>
              <head><title>%s</title></head>
              <body onload="init({ debug: false })">
                %s
              </body>
            </html>
            """.formatted(title, body);
        return page;
    }

    public static void main(String[] args) {
        System.out.println(TOP_CUSTOMERS);
        System.out.println(html("Report", "<p>Nothing to see</p>"));
    }
}
