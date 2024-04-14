/**
 * SRP(Single Responsibility Principle) - 단일 책임 원칙
 *
 * 클래스는 오직 하나의 책임만을 가짐
 *
 * @example
 * BlogPost에서 Display 역할을 가진 클래스를 분리
 * BlogPost는 더이상 display 라는 책임을 가지지 않게됨
 */
class BlogPost {
  title: string;
  content: string;

  constructor(title: string, content: string) {
    this.title = title;
    this.content = content;
  }

  createPost() {}

  updatePost() {}

  deletePost() {}
}

class BlogPostDisplay {
  constructor(public blogPost: BlogPost) {}

  displayHtml() {
    return `<h1>${this.blogPost.title}</h1><p>${this.blogPost.content}</p>`;
  }
}

class BlogPostJson {
  constructor(public blogPost: BlogPost) {}

  returnJSON() {
    return {
      title: this.blogPost.title,
      content: this.blogPost.content,
    };
  }
}
