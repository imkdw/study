export class ProductListService {
  constructor(private categoryRepository: CategoryRepository, private productRepository: ProductRepository) {}

  getProductOfCategory(categoryId: number, page: number, size: number): Page<Product> {
    const category = this.categoryRepository.findById(categoryId);
    this.checkCategory(category);
    const products = this.productRepository.findByCategoryId(categoryId, page, size);
    const totalACount = this.productRepository.countByCategoryId(categoryId);

    return new Page(products, totalACount);
  }
}
