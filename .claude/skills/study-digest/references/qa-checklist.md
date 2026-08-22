# 마무리 점검표

## 구조

- [ ] `meta.json` 의 아이템 수 == 산출물의 `<article class="item">` 수 == 원본 md 파일 수
- [ ] 어셈블러 경고 0 (id 누락/중복/순서 불일치 없음)
- [ ] 태그 균형: `article` / `div` / `pre` / `table`
- [ ] 사이드바와 본문 사이 앵커가 전부 살아 있음
- [ ] 원본 md 중 빠진 파일 없음

## 내용

- [ ] 원문의 코드 예제가 전부 살아 있음
- [ ] 원문 소제목 순서 유지
- [ ] 오탈자 교정 완료
- [ ] 교정/보강 콜아웃에 근거가 있음
- [ ] 추측을 단정으로 쓴 문장 없음

## 시각화

- [ ] `<img>` 태그 0개 — 모든 스크린샷이 컴포넌트로 재현됨
- [ ] 원본 이미지 개수만큼 대응 컴포넌트가 존재
- [ ] 모든 `figure` 에 캡션이 있음
- [ ] mermaid 블록이 실제로 렌더됨 (브라우저 확인)

## 마크업

- [ ] 코드 블록 안 `<` `>` `&` 이스케이프 완료 — 제네릭 `Array<string>` 주의
- [ ] `style="` 인라인 스타일 0개
- [ ] CSS 에 없는 클래스 사용 0개
- [ ] `<pre>` 직후 개행 없음

## 표시

- [ ] 라이트/다크 양쪽에서 대비 충분
- [ ] 375px 폭에서 페이지 가로 스크롤 없음
- [ ] 검색으로 임의의 아이템이 찾아짐
- [ ] 스크롤 시 사이드바 활성 표시와 breadcrumb 이 따라옴

## 검사 스크립트

챕터 partial 을 쓸 때마다 돌린다. 균형이 깨지면 <b>그 챕터 안에서</b> 바로 찾을 수 있다.

```bash
node -e '
const fs=require("fs");const h=fs.readFileSync(process.argv[1],"utf8");
const p=(t,o,c)=>console.log(t,o,c,o===c?"OK":"MISMATCH");
p("div",(h.match(/<div[ >]/g)||[]).length,(h.match(/<\/div>/g)||[]).length);
p("article",(h.match(/<article/g)||[]).length,(h.match(/<\/article>/g)||[]).length);
p("pre",(h.match(/<pre[ >]/g)||[]).length,(h.match(/<\/pre>/g)||[]).length);
p("table",(h.match(/<table>/g)||[]).length,(h.match(/<\/table>/g)||[]).length);
' <partial.html>
```

최종 산출물에는 아래를 돌린다.

```bash
OUT="<산출물>"; SRC="<원본 폴더>"
echo "article: $(grep -c '<article class="item"' "$OUT") / md: $(find "$SRC" -name '*.md' | wc -l)"
echo "img 잔존: $(grep -o '<img' "$OUT" | wc -l)   인라인 style: $(grep -o 'style="' "$OUT" | wc -l)"
grep -o 'id="item-[0-9]*"' "$OUT" | sort | uniq -d   # 중복 id (비어야 정상)

node -e '
const fs=require("fs");const h=fs.readFileSync(process.argv[1],"utf8");
// 1) 앵커 무결성 — 끊어진 내부 링크 찾기
const ids=new Set([...h.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));
const hrefs=[...h.matchAll(/href="#([^"]+)"/g)].map(m=>m[1]);
const dead=[...new Set(hrefs)].filter(x=>!ids.has(x));
console.log("앵커",hrefs.length,"/ 끊어짐",dead.length,dead.length?dead:"");
// 2) 코드블록 안 이스케이프 누락 — 제네릭에서 가장 자주 터진다
const blocks=[...h.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].map(m=>m[1]);
const bad=blocks.filter(b=>/<[A-Za-z\/!]/.test(
  b.replace(/<\/?(code|span|a)[^>]*>/g,"")));
console.log("코드블록",blocks.length,"/ 이스케이프 누락 의심",bad.length);
// 3) 시각 자산 집계
const n=(re)=>(h.match(re)||[]).length;
console.log("코드",n(/class="code"/g),"| mermaid",n(/class="mermaid"/g),
  "| SVG",n(/<svg /g),"| IDE카드",n(/class="ide"/g),"| 표",n(/<table>/g));
' "$OUT"
```

**앵커 무결성 검사가 특히 중요하다.** 아이템 간 상호 참조(`<a href="#item-7">`)를 많이 걸수록
오타 하나가 죽은 링크가 되는데, 눈으로는 절대 찾을 수 없다.
