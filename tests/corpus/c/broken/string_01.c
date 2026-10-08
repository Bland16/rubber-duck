/* covers: (none) beginner-style program; adjacent string literals on separate lines */
#include <stdio.h>

#define MAX_DAYS 7

int main()
{
    float temps[MAX_DAYS];
    float sum = 0, max;
    int i, n = 0;

    printf("Enter up to %d temperatures "
           "(anything else to stop):\n", MAX_DAYS);

    while (n < MAX_DAYS && scanf("%f", &temps[n]) == 1)
        n++;

    if (n == 0) {
        printf("No data.\n);
        return 1;
    }

    max = temps[0];
    for (i = 0; i < n; i++) {
        sum += temps[i];
        if (temps[i] > max) max = temps[i];
    }

    printf("days: %d\naverage: %.1f\nhottest: %.1f\n", n, sum / n, max);
    return 0;
}
