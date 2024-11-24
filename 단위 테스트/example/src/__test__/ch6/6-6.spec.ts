it("adding_a_comment_to_an_article", () => {
  const sut = new Article();
  const comment = new Comment(
    "Comment Text",
    "John Dae",
    new Date("2024-11-24")
  );

  sut.addComment(comment.text, comment.author, comment.date);

  sut.comments.should().beEquivalentTo(comment);
});
