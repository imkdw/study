class Message {
  header: string;
  body: string;
  footer: string;

  constructor(header: string, body: string, footer: string) {
    this.header = header;
    this.body = body;
    this.footer = footer;
  }
}

interface IRenderer {
  render(message: Message): string;
}

/**
 * MessageRenderer는 여러개의 하위 렌더링 클래스를 가지고 있음
 */
class MessageRenderer implements IRenderer {
  readonly subRenderers: IRenderer[];

  constructor() {
    this.subRenderers = [
      new HeaderRenderer(),
      new BodyRenderer(),
      new FooterRenderer(),
    ];
  }

  render(message: Message): string {
    return this.subRenderers
      .map((renderer) => renderer.render(message))
      .join("\n");
  }
}

/**
 * 하위 렌더링 클래스들
 */
class HeaderRenderer {
  // ...
}

class BodyRenderer {
  // ...
}

class FooterRenderer {
  // ...
}
