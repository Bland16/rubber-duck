/* covers: a multi-line macro; #include, #define and an #error line containing an apostrophe */
#include <stdio.h>
#include <stdlib.h>

#ifndef BUFFER_SIZE
#define BUFFER_SIZE 256
#endif

#if BUFFER_SIZE < 16
#error BUFFER_SIZE is too small, don't go below 16
#endif

#define SWAP(type, a, b) \
    do {                 \
        type tmp_ = (a); \
        (a) = (b);       \
        (b) = tmp_;      \
    } while (0)

#define CHECK_ALLOC(p)                                  \
    if ((p) == NULL) {                                  \
        fprintf(stderr, "out of memory at %s:%d\n",     \
                __FILE__, __LINE__);                    \
        exit(EXIT_FAILURE);                             \
    }

int main(void)
{
    int x = 3, y = 7;
    char *buf = malloc(BUFFER_SIZE);

    CHECK_ALLOC(buf);
    SWAP(int, x, y);
    snprintf(buf, BUFFER_SIZE, "x=%d y=%d", x, y);
    puts(buf);
    free(buf);
    return 0;
}
