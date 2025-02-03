import { Rental } from '../../domain/Rental';
import { RentalDTO } from '../dto/rental.dto';

export class RentalMapper {
  static toDto(rental: Rental): RentalDTO {
    return new RentalDTO(rental.getId());
  }

  static toEntity(dto: RentalDTO): Rental {
    return new Rental(dto.getId());
  }
}
