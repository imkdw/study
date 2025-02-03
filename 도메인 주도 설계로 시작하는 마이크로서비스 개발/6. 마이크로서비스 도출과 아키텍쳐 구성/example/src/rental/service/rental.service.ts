import { Rental } from '../domain/Rental';

export interface RentalService {
  save(rental: Rental): Rental;
}
