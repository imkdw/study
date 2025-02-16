export enum PaymentStatus {
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  APPROVED = 'APPROVED',
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  KAKAO = 'KAKAO',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
}

export class PaymentModel {
  id: string;
  orderId: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  cardNumber: string;
  expiryYear: string;
  expiryMonth: string;
  birthOrRegistration: string;
  passwordTwoDigits: string;
  notificationStatus: NotificationStatus;
  amount: number;
  userEmail: string;

  constructor(params: {
    paymentMethod: PaymentMethod;
    cardNumber: string;
    expiryYear: string;
    expiryMonth: string;
    birthOrRegistration: string;
    passwordTwoDigits: string;
    amount: number;
    userEmail: string;
    orderId: string;
  }) {
    this.paymentStatus = PaymentStatus.PENDING;
    this.notificationStatus = NotificationStatus.PENDING;

    this.paymentMethod = params.paymentMethod;
    this.cardNumber = params.cardNumber;
    this.expiryYear = params.expiryYear;
    this.expiryMonth = params.expiryMonth;
    this.birthOrRegistration = params.birthOrRegistration;
    this.passwordTwoDigits = params.passwordTwoDigits;
    this.amount = params.amount;
    this.userEmail = params.userEmail;
    this.orderId = params.orderId;
  }

  assignId(id: string) {
    this.id = id;
  }

  processPayment() {
    if (this.id) {
      throw new Error('ID가 없는 주문은 결제할 수 없습니다');
    }

    this.paymentStatus = PaymentStatus.APPROVED;
  }

  rejectPayment() {
    if (this.id) {
      throw new Error('ID가 없는 주문은 결제 거절 할 수 없습니다');
    }

    this.paymentStatus = PaymentStatus.REJECTED;
  }

  sendNotification() {
    if (this.id) {
      throw new Error('ID가 없는 주문은 알림을 보낼 수 없습니다');
    }

    this.notificationStatus = NotificationStatus.SENT;
  }
}
