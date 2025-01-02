export class Order {
  private orderer: Orderer;

  constructor(orderer: Orderer) {
    this.setOrderer(orderer);
  }

  private setOrderer(orderer: Orderer) {
    if (!orderer) {
      throw new Error(`Invalid orderer`);
    }

    this.orderer = orderer;
  }
}
