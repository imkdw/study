/** 제목 정규화 + 유사도 + 그리디 클러스터링. dedupe 스테이지가 사용한다. */

/**
 * 제목을 정규화한다.
 * - 유니코드 정규화(NFKC)
 * - 소문자화
 * - 문장부호/기호 제거
 * - 연속 공백 제거
 */
export function normalizeTitle(t: string): string {
  return t
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein 편집 거리. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

/**
 * 정규화된 제목 간 유사도. 0~1, 1이면 동일.
 * `1 - dist / max(len)` 방식. 빈 문자열 둘이면 1을 반환한다.
 */
export function similarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(na, nb);
  return 1 - dist / maxLen;
}

/**
 * 그리디 클러스터링. 각 항목을 기존 클러스터의 대표(가장 먼저 들어간 항목)와 비교해
 * threshold 이상이면 그 클러스터에 합치고, 아니면 새 클러스터를 만든다.
 */
export function clusterTitles<T>(
  items: T[],
  getTitle: (x: T) => string,
  threshold: number,
): T[][] {
  const clusters: T[][] = [];

  for (const item of items) {
    const title = getTitle(item);
    let target: T[] | null = null;

    for (const cluster of clusters) {
      const repTitle = getTitle(cluster[0]);
      if (similarity(title, repTitle) >= threshold) {
        target = cluster;
        break;
      }
    }

    if (target) target.push(item);
    else clusters.push([item]);
  }

  return clusters;
}
