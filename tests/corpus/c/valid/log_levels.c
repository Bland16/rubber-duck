// covers: an enum; typedef enum
#include <stdio.h>

enum log_level { LOG_DEBUG, LOG_INFO, LOG_WARN, LOG_ERROR };

typedef enum {
    SHAPE_CIRCLE = 1,
    SHAPE_SQUARE,
    SHAPE_TRIANGLE
} ShapeKind;

static const char *level_name(enum log_level lvl)
{
    switch (lvl) {
    case LOG_DEBUG: return "debug";
    case LOG_INFO:  return "info";
    case LOG_WARN:  return "warn";
    case LOG_ERROR: return "error";
    }
    return "?";
}

static int sides(ShapeKind k)
{
    if (k == SHAPE_SQUARE) return 4;
    if (k == SHAPE_TRIANGLE) return 3;
    return 0;
}

int main(void)
{
    enum log_level lvl = LOG_WARN;
    printf("[%s] a square has %d sides\n", level_name(lvl), sides(SHAPE_SQUARE));
    return 0;
}
