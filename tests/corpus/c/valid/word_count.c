/* covers: while ((c = getchar()) != EOF); #include and #define */
#include <stdio.h>
#include <ctype.h>

#define IN  1
#define OUT 0

int main(void)
{
    int c, state = OUT;
    long lines = 0, words = 0, chars = 0;

    while ((c = getchar()) != EOF) {
        ++chars;
        if (c == '\n')
            ++lines;
        if (isspace(c))
            state = OUT;
        else if (state == OUT) {
            state = IN;
            ++words;
        }
    }
    printf("%ld %ld %ld\n", lines, words, chars);
    return 0;
}
