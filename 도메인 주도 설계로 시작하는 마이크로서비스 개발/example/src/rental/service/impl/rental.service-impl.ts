import { Injectable } from '@nestjs/common';
import { RentalService } from '../rental.service';
import { Rental } from '../../domain/Rental';

@Injectable()
export class RentamServiceImpl implements RentalService {
  save(rental: Rental): Rental {
    return rental;
  }
}
