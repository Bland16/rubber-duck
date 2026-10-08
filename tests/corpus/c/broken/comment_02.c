/* covers: a multi-line macro; an enum; #include and #define */
#include <stdint.h>
#include <stdio.h>

enum perm {
    PERM_READ  = 1 << 0,
    PERM_WRITE = 1 << 1,
    PERM_EXEC  = 1 << 2
};

union word {
    uint32_t u32;
    uint8_t bytes[4];
};

/* X-macro: one entry per permission bit
#define FOR_EACH_PERM(X) \
    X(PERM_READ, 'r')    \
    X(PERM_WRITE, 'w')   \
    X(PERM_EXEC, 'x')

static void print_perms(unsigned flags)
{
#define X(bit, ch) putchar((flags & (bit)) ? (ch) : '-');
    FOR_EACH_PERM(X)
#undef X
    putchar('\n');
}

static inline int is_little_endian(void)
{
    union word w;
    w.u32 = 0x01020304u;
    return w.bytes[0] == 0x04;
}

int main(void)
{
    unsigned flags = PERM_READ | PERM_EXEC;

    print_perms(flags);
    flags |= PERM_WRITE;
    flags &= ~PERM_EXEC;
    print_perms(flags);
    printf("%s endian\n", is_little_endian() ? "little" : "big");
    return 0;
}
