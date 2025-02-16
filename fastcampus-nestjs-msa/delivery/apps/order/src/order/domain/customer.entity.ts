export class CustomerEntity {
  userId: string;
  email: string;
  name: string;

  constructor(param: { userId: string; email: string; name: string }) {
    this.userId = param.userId;
    this.email = param.email;
    this.name = param.name;
  }
}
