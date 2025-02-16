export class CreateOrderDto {
  userId: string;
  productIds: string[];
  address: AddressDto;
  payment: PaymentDto;
}

export class AddressDto {
  name: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export class PaymentDto {
  paymentMethod: string;
  amount: number;
}
