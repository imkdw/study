abstract class PaymentProcessor {
  abstract processPayment(amount: number): void;
}

class CreditCardProcessor extends PaymentProcessor {
  processPayment(amount: number): void {
    console.log(`CreditCardProcessor: ${amount}`);
  }
}

class DebitCardProcessor extends PaymentProcessor {
  processPayment(amount: number): void {
    console.log(`DebitCardProcessor: ${amount}`);
  }
}

class PayPalProcessor extends PaymentProcessor {
  processPayment(amount: number): void {
    console.log(`PayPalProcessor: ${amount}`);
  }
}

function executePayment(paymentProcessor: PaymentProcessor, amount: number) {
  paymentProcessor.processPayment(amount);
}

let creditCardProcessor = new CreditCardProcessor();
let debitCardProcessor = new DebitCardProcessor();
let payPalProcessor = new PayPalProcessor();

executePayment(creditCardProcessor, 100);
executePayment(debitCardProcessor, 200);
executePayment(payPalProcessor, 300);
