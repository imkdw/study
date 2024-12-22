interface IMessaging {
  publish(payload: Message): void;
  subscribe(type: Message, callback: Action): void;
}

export class SQSBus implements IMessaging {
  publish(payload: Message): void {}

  subscribe(type: Message, callback: Action): void {}
}
