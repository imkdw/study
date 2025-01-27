import { ProductRecommendationService } from "./ProductRecommendationService.js";

export class RecSystemClient implements ProductRecommendationService {
  constructor(private readonly externalRecClient: ExternalRecClient) {}

  getRecommendationsOf(id: ProductId): Product[] {
    const items = this.getRecItems(id);
    return this.toProducts(items);
  }

  private getRecItems(id: string) {
    return this.externalRecClient.getRecItems(id);
  }

  private toProducts(items: RecItem[]): Product[] {
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
    }));
  }
}
