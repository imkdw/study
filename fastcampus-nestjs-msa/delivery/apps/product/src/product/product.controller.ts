import { Controller, Post, UseInterceptors, UsePipes, ValidationPipe } from '@nestjs/common';
import { ProductService } from './product.service';
import { MessagePattern, Payload, Transport } from '@nestjs/microservices';
import { GetProductsDto } from './dto/get-products.dto';
import { RpcInterceptor } from '../../../../libs/common/src/interceptor';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post('sample')
  async createSamples() {
    await this.productService.createSamples();
  }

  @MessagePattern({ cmd: 'get_products_info', transport: Transport.TCP })
  @UsePipes(ValidationPipe)
  @UseInterceptors(RpcInterceptor)
  async getProductsInfo(@Payload() dto: GetProductsDto) {
    return this.productService.getProductsInfo(dto);
  }
}
