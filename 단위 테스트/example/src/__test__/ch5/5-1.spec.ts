interface IEmailGateway {
  sendGreetingsEmail(email: string): void;
}

it("sending_a_greetings_email", () => {
  /**
   * mock 도구로 목 생성
   *
   * jest.Mocked<IEmailGateway>는 도구로서의 목이다
   *
   * mock 변수는 테스트 대역으로서의 목이다
   */
  const mock: jest.Mocked<IEmailGateway> = {
    sendGreetingsEmail: jest.fn(),
  };
  const email = "user@gmail.com";

  const sut = new Controller(mock);

  sut.greetUser(email);

  expect(mock.sendGreetingsEmail).toHaveBeenCalledWith(email);
  expect(mock.sendGreetingsEmail).toHaveBeenCalledTimes(1);
});
