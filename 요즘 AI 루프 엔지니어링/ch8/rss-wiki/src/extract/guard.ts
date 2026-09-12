/** extract 스테이지의 안전장치: 도메인별 rate limit, robots.txt 존중. */

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }
}

/** 도메인별로 최소 간격(1000/rps ms)을 보장하는 레이트 리미터. */
export class DomainRateLimiter {
  private readonly minIntervalMs: number;
  private readonly sleepImpl: (ms: number) => Promise<void>;
  private readonly nowImpl: () => number;
  private readonly lastAccess = new Map<string, number>();

  constructor(
    rps: number,
    sleepImpl?: (ms: number) => Promise<void>,
    nowImpl?: () => number,
  ) {
    this.minIntervalMs = 1000 / Math.max(rps, 0.0001);
    this.sleepImpl = sleepImpl ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.nowImpl = nowImpl ?? (() => Date.now());
  }

  async acquire(url: string): Promise<void> {
    const domain = getDomain(url);
    const now = this.nowImpl();
    const last = this.lastAccess.get(domain);

    if (last !== undefined) {
      const wait = this.minIntervalMs - (now - last);
      if (wait > 0) {
        await this.sleepImpl(wait);
      }
    }

    this.lastAccess.set(domain, this.nowImpl());
  }
}

interface RobotsGroup {
  agents: string[];
  disallow: string[];
}

function extractUaToken(userAgent: string): string {
  const m = userAgent.match(/^[A-Za-z0-9._-]+/);
  return (m ? m[0] : userAgent).toLowerCase();
}

/** User-agent: * 와 자기 UA 토큰 섹션의 Disallow 규칙만 해석한다. */
function parseRobots(text: string, userAgent: string): string[] {
  const uaToken = extractUaToken(userAgent);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean);

  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let groupHasRule = false;

  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === 'user-agent') {
      if (!current || groupHasRule) {
        current = { agents: [], disallow: [] };
        groups.push(current);
        groupHasRule = false;
      }
      current.agents.push(value.toLowerCase());
    } else if (key === 'disallow' && current) {
      current.disallow.push(value);
      groupHasRule = true;
    } else if (key === 'allow' && current) {
      groupHasRule = true;
    }
  }

  const uaGroup = groups.find((g) => g.agents.includes(uaToken));
  const starGroup = groups.find((g) => g.agents.includes('*'));
  const chosen = uaGroup ?? starGroup;
  if (!chosen) return [];

  // 빈 Disallow 는 전체 허용을 의미하므로 규칙 목록에서 제외한다.
  return chosen.disallow.filter((d) => d.length > 0);
}

/** 도메인당 robots.txt 를 1회 fetch 해서 캐시한다. */
export class RobotsCache {
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly cache = new Map<string, string[]>();
  private readonly pending = new Map<string, Promise<string[]>>();

  constructor(opts: { fetchImpl?: typeof fetch; userAgent: string; timeoutMs: number }) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.userAgent = opts.userAgent;
    this.timeoutMs = opts.timeoutMs;
  }

  async isAllowed(url: string): Promise<boolean> {
    let origin: string;
    let path: string;
    try {
      const u = new URL(url);
      origin = u.origin;
      path = u.pathname + u.search;
    } catch {
      return true;
    }

    const rules = await this.getRules(origin);
    return !rules.some((prefix) => path.startsWith(prefix));
  }

  private getRules(origin: string): Promise<string[]> {
    const cached = this.cache.get(origin);
    if (cached) return Promise.resolve(cached);

    const pending = this.pending.get(origin);
    if (pending) return pending;

    const p = this.fetchRules(origin).then((rules) => {
      this.cache.set(origin, rules);
      this.pending.delete(origin);
      return rules;
    });
    this.pending.set(origin, p);
    return p;
  }

  private async fetchRules(origin: string): Promise<string[]> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let res: Response;
      try {
        res = await this.fetchImpl(`${origin}/robots.txt`, {
          signal: controller.signal,
          headers: { 'User-Agent': this.userAgent },
        });
      } finally {
        clearTimeout(timer);
      }
      // fetch 실패/404 면 허용으로 본다.
      if (!res.ok) return [];
      const text = await res.text();
      return parseRobots(text, this.userAgent);
    } catch {
      return [];
    }
  }
}
