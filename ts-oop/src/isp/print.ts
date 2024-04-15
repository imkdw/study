/**
 * ISP(Interface Segregation Principle) - 인터페이스 분리 원칙
 *
 * 객체는 자신이 사용하는 메서드에만 의존함
 *
 * 아래 예제는 Machine이라는 큰 인터페이스에서 프린터, 스캐너, 팩스로 잘게 쪼갠 인터페이스로 분리함
 */
interface Machine {
  print(document: Document): void;
  scan(document: Document): void;
  fax(document: Document): void;
}

class MultiFunctionPrinter implements Machine {
  print(document: Document): void {
    console.log("MultiFunctionPrinter print");
  }

  scan(document: Document): void {
    console.log("MultiFunctionPrinter scan");
  }

  fax(document: Document): void {
    console.log("MultiFunctionPrinter fax");
  }
}

interface Printer {
  print(document: Document): void;
}

interface Scanner {
  scan(document: Document): void;
}
