import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    const a = 1;
    const b = 2;
    console.log(a, b);
    return this.appService.getHello();
  }
}
