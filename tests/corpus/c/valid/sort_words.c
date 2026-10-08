/* covers: an array initialiser across lines (plus function pointers) */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int by_length(const void *a, const void *b)
{
    const char *const *sa = a;
    const char *const *sb = b;
    size_t la = strlen(*sa), lb = strlen(*sb);

    if (la != lb)
        return la < lb ? -1 : 1;
    return strcmp(*sa, *sb);
}

static void each(const char **items, size_t n, void (*fn)(const char *))
{
    size_t i;
    for (i = 0; i < n; i++)
        fn(items[i]);
}

static void show(const char *s)
{
    printf("%-10s %2d\n", s, (int)strlen(s));
}

int main(void)
{
    const char *words[] = {
        "pear", "fig", "banana",
        "kiwi", "clementine", "plum"
    };
    size_t n = sizeof words / sizeof words[0];

    qsort(words, n, sizeof words[0], by_length);
    each(words, n, show);
    return 0;
}
