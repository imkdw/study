const enhancedCalculatorHandler = {
  get(target: any, property: any) {
    if (property === "add") {
      return function add() {
        // ...
      };
    } else if (property === "minus") {
      return function minus() {
        // ...
      };
    }

    return target[property];
  },
};

class Calculator {
  minus(a: number, b: number) {
    return a - b;
  }

  multiple(a: number, b: number) {
    return a * b;
  }
}

const calculator = new Proxy(new Calculator(), enhancedCalculatorHandler);
