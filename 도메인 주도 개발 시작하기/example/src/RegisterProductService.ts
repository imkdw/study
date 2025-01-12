export class RegisterProductService {
  registerNewProduct(req: NewProductRequest): ProductId {
    const store = this.storeRepository.findById(req.storeId);
    if (!store) {
      throw new Error("store not found");
    }

    const id = this.productIdGenerator.generate();
    const product = store.createProduct(id);
    this.productRepository.save(product);

    return id;
  }
}
