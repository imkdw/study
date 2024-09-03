"use strict";
const enhancedCalculatorHandler = {
    get(target, property) {
        if (property === "add") {
            return function add() {
                // ...
            };
        }
        else if (property === "minus") {
            return function minus() {
                // ...
            };
        }
        return target[property];
    },
};
class Calculator {
    minus(a, b) {
        return a - b;
    }
    multiple(a, b) {
        return a * b;
    }
}
const calculator = new Proxy(new Calculator(), enhancedCalculatorHandler);
