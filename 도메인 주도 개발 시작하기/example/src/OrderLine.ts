export class OrderLine {
  private product: Product;
  private price: number;
  private quantity: number;
  private amouts: number;

  constructor(product: Product, price: number, quantity: number) {
    this.product = product;
    this.price = price;
    this.quantity = quantity;
    this.amouts = quantity * price;
  }

  private calculateAmounts() {
    return this.quantity * this.price;
  }

  getAmounts(): number {
    return this.amouts;
  }
}
