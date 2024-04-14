/**
 * Customer 인터페이스에 giveDiscount() 메소드를 정의하고 각 Customer 마다 할인율을 반환하도록 구현
 * 새로운 등급의 할인율을 추가할 때는 Customer 인터페이스를 구현하는 클래스를 추가하면 됨
 * OCP 원칙을 지키는 방법
 */

interface Customer {
  giveDiscount(): number;
  addLoyaltyPoints(amountSpent: number): number;
}

export class RegularCustomer implements Customer {
  giveDiscount(): number {
    return 10;
  }

  addLoyaltyPoints(amountSpent: number): number {
    return amountSpent * 2;
  }
}

export class PremiumCustomer implements Customer {
  giveDiscount(): number {
    return 20;
  }

  addLoyaltyPoints(amountSpent: number): number {
    return amountSpent * 3;
  }
}

export class Discount {
  giveDiscount(customer: Customer): number {
    return customer.giveDiscount();
  }
}
