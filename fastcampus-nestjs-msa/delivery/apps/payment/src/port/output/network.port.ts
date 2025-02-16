export interface NetworkOutputPort {
  sendNotification(orderId: string, to: string): Promise<void>;
}
