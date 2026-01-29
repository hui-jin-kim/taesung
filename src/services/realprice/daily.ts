export type TxKind = "sale" | "jeonse" | "wolse" | "presale";

export type DailyTxn = {
  ym: string;
  date?: string;
  complex: string;
  pyeong?: number;
  areaM2?: number;
  type: TxKind;
  rawType?: TxKind;
  price: number;
  deposit?: number;
  monthly?: number;
};

export type DailySnapshot = {
  generatedAt: string;
  range: { from: string; to: string };
  monthlyTotals: Record<string, { date: string; total: number; count: number }[]>; // ALL or complex key
  seriesByComplexPyeong: Record<string, Record<string, { date: string; price: number }[]>>; // complex -> pyeong -> series
  // aggregated
  monthlyTotalsByType?: Record<string, Record<TxKind, { date: string; total: number; count: number }[]>>;
  seriesByComplexPyeongByType?: Record<
    string,
    Record<string, Record<TxKind, { date: string; avg: number; median: number; count: number }[]>>
  >;
  transactions: DailyTxn[];
};

const SNAPSHOT_CACHE_KEY = "rj_realprice_snapshot_v1";
const SNAPSHOT_CACHE_TS_KEY = "rj_realprice_snapshot_v1_ts";
// 캐시를 강제로 비활성화해 매 요청마다 최신 스냅샷을 불러옵니다.
const SNAPSHOT_TTL_MS = 0;

async function tryFetch(url: string): Promise<DailySnapshot | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as DailySnapshot;
    if (!j || !j.generatedAt) return null;
    return j;
  } catch {
    return null;
  }
}

function readCachedSnapshot(): { snapshot: DailySnapshot; ts: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_CACHE_KEY);
    const ts = Number(window.localStorage.getItem(SNAPSHOT_CACHE_TS_KEY));
    if (!raw || !ts) return null;
    return { snapshot: JSON.parse(raw) as DailySnapshot, ts };
  } catch {
    return null;
  }
}

function writeCachedSnapshot(snapshot: DailySnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(snapshot));
    window.localStorage.setItem(SNAPSHOT_CACHE_TS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

function isCacheFresh(ts: number) {
  return Date.now() - ts < SNAPSHOT_TTL_MS;
}

async function fetchSnapshotFromNetwork(): Promise<DailySnapshot | null> {
  const bust = Date.now();

  // 1) Hosting 프록시를 먼저 시도한다. (Storage 요청 실패 로그를 줄이기 위함)
  const hostingLatest = await tryFetch(`/realprice/daily_latest.json?ts=${bust}`);
  if (hostingLatest) return hostingLatest;

  const base = (import.meta as any)?.env?.VITE_REALPRICE_BASE || "";
  // 일부 환경에서 버킷을 rj-realestate-1dae8.firebasestorage.app 으로 넣는 경우가 있어 CORS를 유발한다.
  // Firebase Storage REST URL은 appspot.com 도메인을 사용해야 하므로 여기서 교정해 준다.
  const fixedBase = base.replace("firebasestorage.app", "appspot.com");
  const normalized = fixedBase.endsWith("/") ? fixedBase.slice(0, -1) : fixedBase;

  const join = (path: string) => {
    if (!normalized) return path;

    // base가 %2Frealprice 로 인코딩돼 있는 경우
    if (normalized.includes("%2Frealprice")) {
      const [prefix, suffix] = normalized.split("%2Frealprice");
      if (suffix !== undefined) {
        return `${prefix}%2Frealprice%2F${encodeURIComponent(path)}?alt=media&ts=${bust}`;
      }
    }

    // base가 /realprice 로 끝나는 경우: object name에 %2F를 넣어야 함
    const lower = normalized.toLowerCase();
    const hasFolder = lower.endsWith("/realprice") || lower.endsWith("/realprice/");
    const basePath = hasFolder ? normalized.replace(/\/$/, "") : `${normalized.replace(/\/$/, "")}/realprice`;
    return `${basePath}%2F${encodeURIComponent(path)}?alt=media&ts=${bust}`;
  };

  // 2) env 기반 Storage URL 시도 (Hosting이 실패했을 때만)
  const latest = await tryFetch(join("daily_latest.json"));
  if (latest) return latest;

  return null;
}

// Loads override first, then latest snapshot. Uses localStorage cache to avoid redundant fetches.
export async function loadDailySnapshot(opts?: { force?: boolean }): Promise<DailySnapshot | null> {
  const force = opts?.force ?? false;
  const cached = readCachedSnapshot();
  if (cached && !force && isCacheFresh(cached.ts)) {
    return cached.snapshot;
  }

  const fetched = await fetchSnapshotFromNetwork();
  if (fetched) {
    writeCachedSnapshot(fetched);
    return fetched;
  }

  return cached?.snapshot ?? null;
}

export function clearDailySnapshotCache() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SNAPSHOT_CACHE_KEY);
    window.localStorage.removeItem(SNAPSHOT_CACHE_TS_KEY);
  } catch {
    // ignore
  }
}

export function getPyeongSeries(snapshot: DailySnapshot, complex: string) {
  return snapshot.seriesByComplexPyeong[complex] || {};
}

export function getMonthlyTotals(snapshot: DailySnapshot, complex?: string) {
  if (complex && snapshot.monthlyTotals[complex]) return snapshot.monthlyTotals[complex];
  return snapshot.monthlyTotals.ALL || [];
}

export function filterTransactions(snapshot: DailySnapshot, complexes?: string[]) {
  if (!complexes || complexes.length === 0) return snapshot.transactions;
  const set = new Set(complexes);
  return snapshot.transactions.filter((t) => set.has(t.complex));
}

// Helper: pick pyeong series by type and aggregation method (avg|median)
export function getPyeongSeriesByType(
  snapshot: DailySnapshot,
  complex: string,
  kind: TxKind,
  agg: "avg" | "median" = "avg",
): Record<string, { date: string; price: number }[]> {
  const root = snapshot.seriesByComplexPyeongByType?.[complex] || {};
  const out: Record<string, { date: string; price: number }[]> = {};
  for (const p of Object.keys(root)) {
    const series = (root as any)[p]?.[kind] as { date: string; avg: number; median: number }[] | undefined;
    if (!series) continue;
    out[p] = series.map((row) => ({ date: row.date, price: agg === "avg" ? row.avg : row.median }));
  }
  return out;
}

// Helper: merge monthly totals across multiple types
export function mergeMonthlyTotalsByTypes(
  snapshot: DailySnapshot,
  scope: "ALL" | string,
  kinds: TxKind[],
): { date: string; total: number; count: number }[] {
  const src = snapshot.monthlyTotalsByType?.[scope];
  if (!src) return [];
  const map = new Map<string, { total: number; count: number }>();
  for (const k of kinds) {
    const arr = (src as any)[k] as { date: string; total: number; count: number }[] | undefined;
    if (!arr) continue;
    for (const row of arr) {
      if (!map.has(row.date)) map.set(row.date, { total: 0, count: 0 });
      const v = map.get(row.date)!;
      v.total += row.total;
      v.count += row.count;
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, total: v.total, count: v.count }));
}
