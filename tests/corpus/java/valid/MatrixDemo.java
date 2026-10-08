// covers: a multi-line array initialiser; braces on their own line
public class MatrixDemo
{
    private static final int[][] IDENTITY =
    {
        { 1, 0, 0 },
        { 0, 1, 0 },
        { 0, 0, 1 }
    };

    private static final String[] NAMES = {
        "alpha",
        "beta",
        "gamma"
    };

    public static int trace(int[][] m)
    {
        int sum = 0;
        for (int i = 0; i < m.length; i++)
        {
            sum += m[i][i];
        }
        return sum;
    }

    public static void main(String[] args)
    {
        System.out.println("trace = " + trace(IDENTITY));
        for (String name : NAMES)
        {
            System.out.println(name);
        }
    }
}
