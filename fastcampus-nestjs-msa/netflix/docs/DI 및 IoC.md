# 일반 인스턴스화

```ts
class A {
  b = new B();
}

class B {}
```

<br>

# DI

```ts
class A {
  constructor(private b: B) {}
}

class B {}
```

<br>

# IoC

### NestJS IoC Container

- 인스턴스 생성 및 주입 자동화

```ts
class B {}
new B();

class C {}
new C();
```

<br>

### 사용법

```ts
class A {
  constructor(private instance: B) {}
}

class D {
  constructor(private instance: C) {}
}
```
