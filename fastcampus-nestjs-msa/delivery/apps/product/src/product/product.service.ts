import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product } from './entity/product.entity';
import { GetProductsDto } from './dto/get-products.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async createSamples() {
    const data = [
      {
        name: 'Product 1',
        price: 1000,
        description: 'Description 1',
        stock: 2,
      },
      {
        name: 'Product 2',
        price: 2000,
        description: 'Description 2',
        stock: 4,
      },
      {
        name: 'Product 3',
        price: 3000,
        description: 'Description 3',
        stock: 6,
      },
    ];

    await this.productRepository.insert(data);
  }

  async getProductsInfo(dto: GetProductsDto) {
    const { productIds } = dto;

    const products = await this.productRepository.find({ where: { id: In(productIds) } });

    return products;
  }
}
