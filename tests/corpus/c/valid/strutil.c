/* covers: (none) string helpers, compact K&R style */
#include <ctype.h>
#include <stddef.h>
#include <stdio.h>

static char *trim(char *s) {
    char *end;
    while (isspace((unsigned char)*s)) s++;
    if (*s == '\0') return s;
    end = s;
    while (*end) end++;
    end--;
    while (end > s && isspace((unsigned char)*end)) end--;
    end[1] = '\0';
    return s;
}

static size_t count_char(const char *s, char ch) {
    size_t n = 0;
    for (; *s; s++)
        if (*s == ch) n++;
    return n;
}

static void to_upper(char *s) {
    for (; *s; s++) *s = (char)toupper((unsigned char)*s);
}

int main(void) {
    char buf[] = "   hello, world   ";
    char *t = trim(buf);
    to_upper(t);
    printf("[%s] has %lu l's\n", t, (unsigned long)count_char(t, 'L'));
    return 0;
}
