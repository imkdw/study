it("adding_a_comment_to_an_article", () => {
  const sut = new Article();
  const text = "Comment Text";
  const author = "John Dae";
  const now = new Date("2024-11-24");

  sut.addComment(text, author, now);

  /**
   * 글(Article)의 상태를 검증함
   */
  sut.shouldContainNumberOfComment(1).withComment(text, author, now);
});
