class Factory {
  createAvatarMovie(): Movie {
    return new Movie("Avatar", ...);
  }
}

class Client {
  private factory: Factory;

  constructor(factory: Factory) {
    this.factory = factory;
  }

  getAvatarFee() {
    return this.factory.createAvatarMovie().getFee();
  }
}