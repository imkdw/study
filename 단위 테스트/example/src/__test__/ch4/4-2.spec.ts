it("messageRenderer_uses_correct_sub_renders", () => {
  const sut = new MessageRenderer();

  const renderers = sut.subRenderers;

  expect(renderers).toHaveLength(3);
  expect(renderers[0]).toBeInstanceOf(HeaderRenderer);
  expect(renderers[1]).toBeInstanceOf(BodyRenderer);
  expect(renderers[2]).toBeInstanceOf(FooterRenderer);
});
