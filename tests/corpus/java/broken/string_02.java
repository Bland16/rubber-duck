// covers: a wrapped if condition followed by an unbraced statement
public class SignupValidator {
    private static final int MIN_PASSWORD = 8;

    public static String validate(String email, String password, String confirm) {
        if (email == null || email.isBlank())
            return Email is required";

        if (!email.contains("@")
                || email.startsWith("@")
                || email.endsWith("@"))
            return "Email looks wrong";

        if (password == null
                || password.length() < MIN_PASSWORD)
            return "Password must be at least " + MIN_PASSWORD + " characters";

        if (!password.equals(confirm))
            return "Passwords do not match";

        return null;
    }

    public static void main(String[] args) {
        String problem = validate("duck@example.com", "quackquack", "quackquack");
        System.out.println(problem == null ? "ok" : problem);
    }
}
