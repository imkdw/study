# 파일/경로 위치

위키 폴더와 SQLite DB 파일을 어디에 둘지. Obsidian vault 안에 바로 쓸지 포함.

- A: 프로젝트 루트 고정 (`./wiki`, `./data/rss-wiki.db`)
- B: `feeds.yaml`의 설정 키(`wiki_dir`, `db_path`)로 지정, 없으면 A의 경로를 기본값으로 사용
- C: XDG 경로 (`~/.local/share/rss-wiki/...`)

합의: B (시도 1회)

반영 완료: PRD 5절 파일 (2026-09-18 planner)
