#include <stdio.h>
#include <stdlib.h>

typedef int ElementType;

typedef struct tagNode
{
  ElementType Data;
  struct tagNode *NextNode;
  struct tagNode *PrevNode;
} Node;

void CDLL_AppendNode(Node **Head, Node *NewNode)
{
  // 해드 노드가 없다면 새로운 노드가 헤드가됨
  if ((*Head == NULL))
  {
    *Head = NewNode;
    (*Head)->NextNode = *Head;
    (*Head)->PrevNode = *Head;
  }
  else
  {
    // 테일과 헤드 사이에 새로운 노드를 추가함
    Node *Tail = (*Head)->PrevNode;

    Tail->NextNode->PrevNode = NewNode;
    Tail->NextNode = NewNode;

    NewNode->NextNode = *Head;
    NewNode->PrevNode = Tail;
  }
}

void CDLL_RemoveNode(Node **Head, Node *Remove)
{
  if (*Head == Remove)
  {
    (*Head)->PrevNode->NextNode = Remove->NextNode;
    (*Head)->NextNode->PrevNode = Remove->PrevNode;

    (*Head) = Remove->NextNode;

    Remove->PrevNode = NULL;
    Remove->NextNode = NULL;
  }
  else
  {
    Remove->PrevNode->NextNode = Remove->NextNode;
    Remove->NextNode->PrevNode = Remove->PrevNode;

    Remove->PrevNode = NULL;
    Remove->NextNode = NULL;
  }
}

int main()
{
  printf("Hello, World!\n");
  printf("Hello, World!\n");
  return 0;
}
