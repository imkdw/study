export class Store {
  createProduct(newProductId: ProductId): Product {
    if (this.isBlocked()) {
      throw new Error("store is blocked");
    }

    return new Product(newProductId, this.id);
  }
}
