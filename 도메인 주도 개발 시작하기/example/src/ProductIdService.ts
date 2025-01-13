export class ProductIdService {
  nextId(): ProductId {
    // ...
  }
}

export class CreateProductService {
  constructor(
    private readonly productIdService: ProductIdService,
    private readonly productRepository: ProductRepository
  ) {}

  createProduct(cmd: ProductCreationCommand) {
    const id = this.productIdService.nextId();
    const product = new Product(id, cmd.getDetail(), cmd.getPrice());
    this.productRepository.save(product);

    return id;
  }
}
