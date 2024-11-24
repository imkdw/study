class Article {
  addComment(text: string): Comment {
    const comment = new Comment(text);
    this.comments.add(comment); // 사이드 이펙트
    return comment;
  }
}
