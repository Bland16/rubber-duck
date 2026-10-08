/* covers: a struct and an array initialiser; #include and #define */
#include <stdio.h>
#include <string.h>

struct item {
    const char *name;
    int qty;
    double price;
};

static struct item stock[] = {
    { "widget", 12, 2.50 },
    { "gadget",  3, 19.99 },
    { "sprocket", 0, 0.75 },
};

static const int primes[] = { 2, 3, 5, 7, 11, 13 };

#define COUNT(a) (sizeof(a) / sizeof((a)[0]))

struct item *find(const char *name)
{
    size_t i;
    for (i = 0; i < COUNT(stock); i++)
        if (strcmp(stock[i].name, name) == 0)
            return &stock[i];
    }
    return NULL;
}

int main(void)
{
    struct item *it = find("gadget");
    if (it != NULL)
        printf("%s: %d @ %.2f\n", it->name, it->qty, it->price);
    printf("%d primes\n", (int)COUNT(primes));
    return 0;
}
