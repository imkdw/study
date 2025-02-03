import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { RentalDTO } from './dto/rental.dto';
import { RentalService } from '../service/rental.service';
import { RentalMapper } from './mapper/rental.mapper';

@Controller('rentals')
export class RentalResource {
  constructor(private readonly rentalService: RentalService) {}

  @Post()
  createRental(@Body() dto: RentalDTO): RentalDTO {
    if (dto.getId()) {
      throw new BadRequestException('렌탈 아이디는 존재하면 안됩니다');
    }

    const rental = RentalMapper.toEntity(dto);

    return RentalMapper.toDto(this.rentalService.save(rental));
  }
}
