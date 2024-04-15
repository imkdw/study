interface Post {
  title: string;
  content: string;
}

interface Comment {
  title: string;
  content: string;
}

interface PostCreator {
  createPost(post: Post): void;
}

interface CommentCreator {
  createComment(commnet: Comment): void;
}

interface PostSharer {
  sharePosts(post: Post): void;
}

class Admin implements PostCreator, CommentCreator, PostSharer {
  createComment(commnet: Comment): void {}

  createPost(post: Post): void {}

  sharePosts(post: Post): void {}
}

class RegularUser implements PostCreator, CommentCreator {
  createComment(commnet: Comment): void {}

  createPost(post: Post): void {}
}
