interface IBus {
  send(message: string): void;
}

class BusSpy implements IBus {
  private sentMessages: string[] = [];

  send(message: string): void {
    this.sentMessages.push(message);
  }

  shouldSendNumberOfMessages(number: number): BusSpy {
    // ...
    return this;
  }

  withEmailChangedMessage(userId: number, newEmail: string): BusSpy {
    // ...
    return this;
  }
}

it("changing_email_from_corporate_to_non_corporate", () => {
  const busSpy = new BusSpy();
  const messageBus = new MessageBus(busSpy);
  const loggerMock: jest.Mocked<ILogger> = {};
  const sut = new UserController(messageBus, loggerMock);

  // ...

  busSpy.shouldSendNumberOfMessages(1).withEmailChangedMessage(userId, newEmail);
});
