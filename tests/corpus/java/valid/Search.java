// covers: (none) dense utility methods with a javadoc comment
public final class Search {
    private Search() {}

    /**
     * Returns the index of {@code key} in the sorted array, or -1.
     * @param a sorted ascending
     */
    public static int binary(int[] a, int key) {
        int lo = 0, hi = a.length - 1;
        while (lo <= hi) {
            int mid = (lo + hi) >>> 1;
            if (a[mid] < key) lo = mid + 1;
            else if (a[mid] > key) hi = mid - 1;
            else return mid;
        }
        return -1;
    }

    public static int[] firstPairWithSum(int[][] grid, int target) {
        outer:
        for (int r = 0; r < grid.length; r++) {
            for (int c = 0; c + 1 < grid[r].length; c++) {
                if (grid[r][c] + grid[r][c + 1] == target) {
                    return new int[] { r, c };
                }
                if (grid[r][c] < 0) continue outer;
            }
        }
        return null;
    }
}
