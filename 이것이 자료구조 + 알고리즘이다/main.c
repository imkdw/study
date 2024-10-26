#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>

typedef int ElementType;

typedef struct tagNode
{
  char *Data;
  struct tagNode *NextNode;
} Node;

typedef struct tagLinkedListStack
{
  Node *List;
  Node *Top;
} LinkedListStack;

void LLS_CreateStack(LinkedListStack **Stack)
{
  (*Stack) = (LinkedListStack *)malloc(sizeof(LinkedListStack));
  (*Stack)->List = NULL;
  (*Stack)->Top = NULL;
}

void LLS_IsEmpty(LinkedListStack *Stack)
{
  return (Stack->List == NULL);
}

void LLS_DestroyStack(LinkedListStack *Stack)
{
  while (!LLS_IsEmpty(Stack))
  {
    Node *Popped = LLS_Pop(Stack);
    LLS_DestroyNode(Popped);
  }

  free(Stack);
}

Node *LLS_CreateNode(char *NewData)
{
  Node *NewNode = (Node *)malloc(sizeof(Node));
  NewNode->Data = (char *)malloc(strlen(NewData) + 1);

  strcpy(NewNode->Data, NewData);
  NewNode->NextNode = NULL;

  return NewNode;
}

void LLS_DestroyNode(Node *_Node)
{
  free(_Node->Data);
  free(_Node);
}

void LLS_Push(LinkedListStack *Stack, Node *NewNode)
{
  if (Stack->List == NULL)
  {
    Stack->List = NewNode;
  }
  else
  {
    // 스택 Top 위쪽에 새로운 노드 추가
    Stack->Top->NextNode = NewNode;
  }

  // 스택의 Top을 새로운 노드로 변경
  Stack->Top = NewNode;
}

Node *LLS_Pop(LinkedListStack *Stack)
{
  // 반환할 최상위 노드 저장
  Node *TopNode = Stack->Top;

  // 1개의 아이템만 있었다면 아무것도 없는 상태로 만듬
  if (Stack->List == Stack->Top)
  {
    Stack->List = NULL;
    Stack->Top = NULL;
  }
  else
  {
    // Top 바로 하단에 있던 노드를 새로운 CurrentTop으로 설정
    Node *CurrentTop = Stack->List;
    while (CurrentTop != NULL && CurrentTop->NextNode != Stack->List)
    {
      CurrentTop = CurrentTop->NextNode;
    }

    // 새로운 Top 설정
    Stack->Top = CurrentTop;
    Stack->Top->NextNode = NULL
  }

  return
}