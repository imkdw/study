interface IDateTimeServer {
  now(): Date;
}

class DateTimeServer implements IDateTimeServer {
  now(): Date {
    return new Date();
  }
}

class InquiryController {
  private readonly dateTimeServer: IDateTimeServer;

  constructor(dateTimeServer: IDateTimeServer) {
    this.dateTimeServer = dateTimeServer;
  }

  approveInquiery(id: number) {
    const inquiry = getById(id);
    inquiry.approve(this.dateTimeServer.now());
    saveInquiry(inquiry);
  }
}
