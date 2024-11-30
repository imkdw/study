class CustomerController {
  // ...

  purchase(customerId: number, productId: number, quantity: number) {
    /**
     * 시스템 간 통신 : 데이터베이스와의 통신
     */
    const customer = this.customerRepository.getById(customerId);
    const product = this.productRepository.getById(productId);

    /**
     * 내부 통신 : Customer, Store 클래스 간 통신
     */
    const isSuccess = customer.purchase(this.mainStore, product, quantity);

    /**
     * 시스템 간 통신 : 이메일 발송을 위한 SMTP 서버와의 통신
     */
    if (isSuccess) {
      customer.sendReceipt(customer.email, product.name, quantity);
    }

    return isSuccess;
  }
}
