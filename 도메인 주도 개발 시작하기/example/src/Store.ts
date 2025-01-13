export class Store {
  createProduct(newProductId: ProductId, productInfo: ProductInfo): Product {
    if (this.isBlocked()) {
      throw new Error("store is blocked");
    }

    return ProductFactory.create(newProductId, this.getId(), productInfo);
  }
}
