class CheckoutService {
  checkout(orderId: number): void {
    const service = new ReportGenerationService();
    const report = service.generateReport(orderId, this);
    // ...
  }
}

class ReportGenerationService {
  generateReport(orderId: number, checkoutService: CheckoutService): void {
    // ...
  }
}
