## LSN(Log Sequence Number)
- WAL 파일 내의 트랜잭션 위치를 식별하는 데 활용함
- WAL File ID / WAL Segment ID + Offset 형식을 따름
  - ex) 14/263F7E88

<br>

## WAL 파일명
- 총 24자리의 16진수로 구성되며 8자리씩 나뉜다
- 첫번째 8개 : Timeline
- 두번째 8개 : WAL File ID
- 세번째 8개 : WAL Segment ID

<br>

### Timeline
- initdb를 통한 DB 클러스터 생성시 1로 시작함
- 이후에 복구 작업이나 리플리카 서버의 마스터 승격(promote)시에 1씩 증가하게됨

<br>

### WAL Segment ID
- 0 ~ 255 사이 값을 가지며 총 세그먼트의 단위는 256개임
- 4GB를 WAL 크기로 나눈 값로 계산됨
- 예를 들어서 WAL 크기가 16MB인 경우 `4GB / 16MB = 256` 이므로 세그먼트 단위가 256이됨

<br>

### WAL File ID
- WAL Segment ID가 256을 넘어갈 때 마다 1씩 증가함

<br>

### PG 함수로 계산해보기
```sql
postgres=# select pg_walfile_name('14/263F7E88');
     pg_walfile_name      
--------------------------
 000000010000001400000026
(1 row)
```