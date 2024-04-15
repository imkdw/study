/**
 * 싱글톤 패턴
 *
 * - 어떤 클래스가 최초 한 번만 메모리를 할당하고(static) 그 메모리에 객체를 만들어 사용하는 디자인 패턴
 * - 생성자가 여러 차례 호출되더라도 실제로 생성되는 객체는 하나이고 최초 생성 이후에 호출된 생성자는 최초에 생성한 객체를 반환
 */
class Singleton {
  private static instance: Singleton;
  private static _value: number;

  private constructor() {}

  static getInstance(): Singleton {
    if (!Singleton.instance) {
      Singleton.instance = new Singleton();
    }

    return Singleton.instance;
  }

  set value(value: number) {
    Singleton._value = value;
  }

  get value(): number {
    return Singleton._value;
  }
}

const instance1 = Singleton.getInstance();
const instance2 = Singleton.getInstance();

instance1.value = 10;
console.log(instance1.value);
console.log(instance2.value);
console.log(instance1 === instance2);
