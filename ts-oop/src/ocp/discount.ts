/**
 * OCP(Open-Closed Principle) - 개방 폐쇄 원칙
 * 개체(함수, 메소드 등)에 대해서 확장에는 열려있지만 수정에는 닫혀있어야 된다는 원칙
 *
 * giveDiscount() 메소드의 경우 만약 새로운 등급의 할인율을 추가한다면 else if 문을 추가하면 됨
 * 이건 수정에도 열려있으므로 OCP 원칙을 위배함
 */
class Discount {
  giveDiscount(customerType: "premium" | "regular" | "gold"): number {
    if (customerType === "regular") {
      return 10;
    } else if (customerType === "premium") {
      return 20;
    } else if (customerType === "gold") {
      return 30;
    } else {
      return 10;
    }
  }
}
