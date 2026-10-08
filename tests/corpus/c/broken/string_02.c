/* covers: strings and comments containing brackets, quotes and semicolons */
#include <stdio.h>
#include <string.h>

/*
 * Prints s as a JSON string: "like \"this\"".
 * Control chars are dropped; (TODO: emit \uXXXX instead); see RFC 8259 [section 7].
 */
static void print_json_string(const char *s)
{
    putchar('"');
    for (; *s; s++) {
        switch (*s) {
        case '"':  fputs("\\\"", stdout); break;
        case '\': fputs("\\\\", stdout); break;
        case '\n': fputs("\\n", stdout);  break;
        default:
            if ((unsigned char)*s >= 0x20)   /* skip control chars; they'd break {parsers} */
                putchar(*s);
        }
    }
    putchar('"');
}

int main(void)
{
    const char *tricky = "braces {} and [brackets]; a 'quote' and a \"double\" (ok)";
    char open = '{', close = '}', semi = ';', apos = '\'';

    print_json_string(tricky);   // output starts with a '"'
    printf("\n%c%c%c%c\n", open, close, semi, apos);
    printf("len=%d\n", (int)strlen("//not a comment; /* nor this */"));
    return 0;
}
