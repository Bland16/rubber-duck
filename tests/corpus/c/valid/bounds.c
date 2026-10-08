/* covers: a wrapped if condition followed by an unbraced statement; a struct */
#include <stdbool.h>
#include <stdio.h>

typedef struct {
    int x, y, w, h;
} rect;

bool overlaps(const rect *a, const rect *b)
{
    if (a->x + a->w <= b->x ||
        b->x + b->w <= a->x ||
        a->y + a->h <= b->y ||
        b->y + b->h <= a->y)
        return false;
    return true;
}

bool contains(const rect *r, int px, int py)
{
    if (px >= r->x && px < r->x + r->w
        && py >= r->y && py < r->y + r->h)
        return true;
    return false;
}

int main(void)
{
    rect a = { 0, 0, 10, 10 };
    rect b = { 5, 5, 10, 10 };

    printf("overlaps: %s\n", overlaps(&a, &b) ? "yes" : "no");
    printf("contains: %s\n", contains(&a, 12, 3) ? "yes" : "no");
    return 0;
}
