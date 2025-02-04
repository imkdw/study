class B {}
new B();

class C {}
new C();

class A {
  constructor(private instance: B) {}
}

class D {
  constructor(private instance: B) {}
}
