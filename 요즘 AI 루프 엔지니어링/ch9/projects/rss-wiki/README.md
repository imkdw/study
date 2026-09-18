# rss-wiki

RSS 피드를 수집하고 본문을 요약해 마크다운 위키로 만드는 CLI 도구.

## 설치

```
uv sync
```

## 설정

```
cp feeds.example.yaml feeds.yaml
```

`feeds.yaml`을 열어 수집할 피드 목록을 채우세요. `wiki_dir`(기본 `./wiki`)과
`db_path`(기본 `./data/rss-wiki.db`)를 생략하면 `feeds.yaml`이 있는 디렉터리
기준 기본값이 쓰입니다. 설정이 잘못되면(파일 없음, `url` 누락 등) 오류 한 줄을
출력하고 종료 코드 1로 끝납니다.

## 전제

`run`을 실행하려면 `claude` 명령이 설치되어 있고 로그인돼 있어야 합니다.
요약할 글이 있을 때만 실행당 사전 확인 1회가 짧은 프롬프트를 실제로
소모합니다. `claude`가 없거나 로그인되지 않으면 글 실패 횟수를 올리지 않고
실행이 오류 메시지와 함께 종료 코드 1로 끝납니다.

## 실행

```
uv run rss-wiki run
```

`--config`(기본 `feeds.yaml`)로 설정 파일 경로를, `--max-summaries`(기본
`20`)로 이번 실행에서 요약할 글 수 상한을 지정할 수 있습니다. 상한을 넘긴
나머지 글은 다음 실행에서 이어서 처리됩니다.

```
uv run rss-wiki run --config feeds.yaml --max-summaries 20
```

실행이 끝나면 다음 여섯 줄을 출력합니다: 새로 등록된 글 수, 요약 성공/실패
수, 이번 실행에서 포기(3회 연속 실패)로 넘어간 글 수, 이번 실행에서 실패/
포기한 피드 수. 포기한 글이나 피드가 있으면 안내 한 줄이 더 나옵니다.

## 테스트

```
uv run pytest
```

## 포기한 글/피드 다시 시도하기

글 하나가 연속 3회 실패하면 상태가 `given_up`으로 바뀌어 더 이상 재시도하지
않습니다. 다시 시도하려면 DB를 직접 열어 상태를 되돌리세요.

```
sqlite3 data/rss-wiki.db "UPDATE articles SET status='pending', failure_count=0 WHERE status='given_up'"
```

피드도 연속 3회 실패하면 다음 실행부터 요청 없이 건너뜁니다. 다시 시도하려면
연속 실패 횟수를 되돌리세요.

```
sqlite3 data/rss-wiki.db "UPDATE feeds SET consecutive_failures = 0"
```
