it("rendering_a_message", () => {
  const sut = new MessageRenderer();
  const message = new Message("h", "b", "f");

  const html = sut.render(message);

  expect(html).toBe("<header>h</header><article>b</article><footer>f</footer>");
});
