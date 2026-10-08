/* covers: braces on their own line */
#include <stdio.h>
#include <stdlib.h>

typedef struct node
{
    int value;
    struct node *next;
} node_t;

node_t *push(node_t *head, int value)
{
    node_t *n = malloc(sizeof *n);
    if (n == NULL)
    {
        return head;
    }
    n->value = value;
    n->next = head;
    return n;
}

/* Reverses the list in place and returns the new head.
node_t *reverse(node_t *head)
{
    node_t *prev = NULL;
    while (head != NULL)
    {
        node_t *next = head->next;
        head->next = prev;
        prev = head;
        head = next;
    }
    return prev;
}

void free_list(node_t *head)
{
    while (head)
    {
        node_t *next = head->next;
        free(head);
        head = next;
    }
}

int main(void)
{
    node_t *list = NULL;
    int i;
    for (i = 0; i < 5; i++)
        list = push(list, i * i);
    list = reverse(list);
    for (node_t *p = list; p != NULL; p = p->next)
        printf("%d ", p->value);
    printf("\n");
    free_list(list);
    return 0;
}
