it("sending_a_greetings_email", () => {
  const emailGatewayMock: jest.Mocked<IEmailGateway> = {
    sendGreetingsEmail: jest.fn(),
  };
  const sut = new Controller(emailGatewayMock);
  const email = "imkdw@gmail.com";

  sut.greetUser(email);

  expect(emailGatewayMock.sendGreetingsEmail).toHaveBeenCalledWith(email);
});
