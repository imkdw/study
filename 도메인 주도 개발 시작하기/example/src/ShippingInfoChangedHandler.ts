export class ShippingInfoChangedHandler {
  @OnEvent(ShippingInfoChangedEvent.name)
  handleShippingChange(payload: any) {
    // 이벤트 처리 로직
  }
}
