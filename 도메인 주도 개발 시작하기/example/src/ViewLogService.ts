export class ViewLogService {
  constructor(private readonly messageClient: MessageClient) {}

  appendViewLog(memberId: string, productId: string, time: Date) {
    this.messageClient.send(new ViewLog(memberId, productId, time));
  }
}

export class RabbitMQClient implements MessageClient {
  constructor(private readonly rabbitTemplate: RabbitTemplate) {}

  send(viewLog: ViewLog) {
    this.rabbitTemplate.convertAndSend("logQueueName", viewLog);
  }
}
