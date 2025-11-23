import { append, flat, map, pipe, reduce, values, zip } from "@fxts/core";

function escapeHtml(val: unknown) {
  const escapeMap = {
    "&": "&amp",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "`": "&#x60;",
  };

  const source = "(?:" + Object.keys(escapeMap).join("|") + ")"; // (?:&|<|>|"|'|`)
  const testRegExp = RegExp(source);
  const replaceRegExp = RegExp(source, "g");

  const string = `${val}`;
  return testRegExp.test(string)
    ? string.replace(replaceRegExp, (match) => escapeMap[match as keyof typeof escapeMap])
    : string;
}

function filTemplate<T>(strs: TemplateStringsArray, vals: T[], transform: (val: T) => string) {
  return pipe(
    vals,
    map(transform),
    append(""),
    zip(strs),
    flat,
    reduce((a, b) => a + b)
  );
}

class Html {
  constructor(private readonly strs: TemplateStringsArray, private readonly vals: unknown[]) {}

  private escape(val: unknown): string {
    return val instanceof Html ? val.toHtml() : escapeHtml(val);
  }

  private combine(vals: unknown) {
    return Array.isArray(vals) ? vals.reduce((a, b) => html`${a}${b}`) : vals;
  }

  toHtml() {
    return filTemplate(this.strs, this.vals, (val) => this.escape(this.combine(val)));
  }
}

function html(strs: TemplateStringsArray, ...vals: unknown[]) {
  return new Html(strs, vals);
}

function upper(strs: TemplateStringsArray, ...vals: string[]) {
  return filTemplate(strs, vals, (val) => val.toUpperCase());
}

const text = "world";
console.log(upper`Hello ${text}`); // Hello WORLD

/**
 * 해당 뷰가 다루게 될 데이터 타입을 명시하기 위해 제네릭 T 선언
 */
abstract class View<T> {
  private _element: HTMLElement | null = null;

  constructor(public data: T) {}

  element() {
    if (!this._element) {
      throw new Error("요소에 접근하기 전에 `render()` 메서드를 호출하세요");
    } else {
      return this._element;
    }
  }

  /**
   * 구체적인 View 클래스의 경우 해당 메서드를 구현해서 DOM에 렌더링할 HTML 구조를 정의해야함
   * Html 템플릿 엔진을 통해서 문자열로 변환되고 결과적으로 브라우저상에서 실제 DOM 요소로 변환됨
   */
  abstract template(): Html;

  /**
   * 반환받은 Html 인스턴스를 임시 div 내부에 삽입함
   * 생성된 첫 번째 자식 요소를 _element에 저장하고 `element` 메서드로 접근이 가능하게 만듦
   * 생성자 이름의 경우 class="" 요소에 추가하고 렌더 완료 후 추가로 처리가 필요한 부분(`onRender`)은 하위 클래스에서 오버라이드하여 구현하게됨
   */
  render(): HTMLElement {
    const wrapEl = document.createElement("div");
    wrapEl.innerHTML = this.template().toHtml();
    this._element = wrapEl.children[0] as HTMLElement;
    this._element.classList.add(this.constructor.name);
    this.onRender();
    return this._element;
  }

  protected onRender() {}
}

type User = {
  name: string;
  age: number;
};

class UserView extends View<User> {
  template(): Html {
    return html`
      <div>
        ${this.data.name} (${this.data.age})
        <button>X</button>
      </div>
    `;
  }

  protected override onRender(): void {
    this.element()
      .querySelector("button")!
      .addEventListener("click", () => this.remove());
  }

  private remove() {
    this.element().remove();
    alert(`${this.data.name} 삭제됨`);
  }
}

const users = [
  { name: "John", age: 20 },
  { name: "Jane", age: 21 },
  { name: "Jim", age: 22 },
];

console.log(new UserView(users[0]!).render().outerHTML);

users
  .map((user) => new UserView(user))
  .map((view) => view.render())
  .forEach((element) => document.body.append(element));
