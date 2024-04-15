/**
 * LSP(Liskov Substitution Principle) - 리스코프 치환 원칙
 *
 * 서브 타입은 언제나 기반타입으로 교체가 가능해야함
 */
// abstract class Shape {
//   abstract calculateArea(): number;
// }

// class Rectangle extends Shape {
//   constructor(private width: number, private height: number) {
//     super();
//   }

//   calculateArea(): number {
//     return this.width * this.height;
//   }
// }

// class Square extends Shape {
//   constructor(private side: number) {
//     super();
//   }

//   calculateArea(): number {
//     return this.side * this.side;
//   }
// }
