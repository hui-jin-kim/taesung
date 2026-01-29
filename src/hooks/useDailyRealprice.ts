import { useEffect, useMemo, useState } from "react";
import {
  loadDailySnapshot,
  getPyeongSeriesByType,
  type DailySnapshot,
  type TxKind,
  type DailyTxn,
} from "../services/realprice/daily";
import { findComplex, getAllComplexes } from "../lib/complexIndex";

let memo: Promise<DailySnapshot | null> | null = null;
export function ensureSnapshot() {
  if (!memo) memo = loadDailySnapshot();
  return memo;
}

export function useDailyRealprice() {
  const [snap, setSnap] = useState<DailySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    ensureSnapshot()
      .then((s) => {
        if (alive) setSnap(s);
      })
      .catch((e) => {
        if (alive) setError(e?.message || "load failed");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { snap, loading, error };
}

export function m2ToPyeong(n?: number) {
  return n ? Math.round(n / 3.3058) : undefined;
}

export function findLatestAvgAndCount(opts: {
  snap: DailySnapshot;
  complex: string;
  pyeong?: number;
  kind?: TxKind; // default 'sale'
  agg?: "avg" | "median"; // default 'avg'
}) {
  const { snap, complex, pyeong, kind = "sale", agg = "avg" } = opts;
  const seriesByP = getPyeongSeriesByType(snap, complex, kind, agg);
  const key = pyeong ? String(pyeong) : undefined;
  const pick = (key && seriesByP[key]) || Object.values(seriesByP)[0] || [];
  const last = pick[pick.length - 1];
  const month = last?.date;
  const price = last?.price ?? 0;

  const mt = snap.monthlyTotalsByType?.[complex]?.[kind] || [];
  const matched = month ? mt.find((r) => r.date === month) : undefined;
  const count = matched?.count ?? 0;

  return { month, price, count, series: pick };
}

type TrendOpts = {
  complex?: string;
  pyeong?: number;
  kind?: TxKind;
  agg?: "avg" | "median";
  months?: number;
};

type RegionKey = "jamwon" | "banpo";

export type RegionSeriesPoint = { date: string; avg: number | null; total: number; count: number };
export type RecentDeal = {
  complex: string;
  region: string;
  date: string;
  price: number;
  type?: TxKind;
  pyeong?: number;
  areaM2?: number;
};

const REGION_LABELS: Record<RegionKey, string> = {
  jamwon: "잠원동",
  banpo: "반포동",
};

type ComplexTrendResult = {
  loading: boolean;
  points: RegionSeriesPoint[];
  latest: RegionSeriesPoint | null;
};

export function useComplexPriceTrend(opts: TrendOpts): ComplexTrendResult {
  const { snap, loading } = useDailyRealprice();
  const { complex, pyeong, kind = "sale", agg = "avg", months = 12 } = opts;
  const normalizedComplex = (complex || "").trim();
  const targetKey = typeof pyeong === "number" ? String(pyeong) : "";

  return useMemo(() => {
    if (!normalizedComplex || !snap) {
      return {
        loading: loading && !snap,
        points: [],
        latest: null,
      };
    }

    const monthKeys = buildRecentMonthKeys(Math.max(1, months || 12));
    const monthSet = new Set(monthKeys);

    const aggMap = new Map<string, { total: number; count: number }>();
    let points: RegionSeriesPoint[] = [];

    snap.transactions.forEach((tx) => {
      if (tx.type !== kind) return;
      if (tx.complex !== normalizedComplex) return;
      const month = getTxMonth(tx);
      if (!month || !monthSet.has(month)) return;
      const entry = ensureAgg(aggMap, month);
      entry.total += tx.price;
      entry.count += 1;
    });

    points = buildSeriesFromAgg(aggMap, monthKeys);
    const latest = [...points].reverse().find((item) => item.count > 0) || null;

    return {
      loading: loading && !snap,
      points,
      latest,
    };
  }, [snap, loading, normalizedComplex, targetKey, kind, agg, months]);
}

function buildMockSeries(seedKey: string, months: number) {
  const start = new Date();
  start.setMonth(start.getMonth() - (months - 1));
  start.setDate(1);
  const rng = createRng(hashSeed(seedKey));
  let price = 800_000_000 + Math.round(rng() * 600_000_000);
  const rows: { date: string; price: number }[] = [];
  for (let i = 0; i < months; i += 1) {
    const cur = new Date(start);
    cur.setMonth(start.getMonth() + i);
    const delta = (rng() - 0.5) * 0.06; // ±3%
    price = Math.max(100_000_000, Math.round(price * (1 + delta)));
    const ym = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
    rows.push({ date: ym, price });
  }
  return rows;
}

function hashSeed(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const UNRESOLVED_POOL = (value?: string | null) => (value || "").trim().toLowerCase();

function buildRecentMonthKeys(months: number) {
  const result: string[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(cursor);
    d.setMonth(cursor.getMonth() - i);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

function ensureAgg(map: Map<string, { total: number; count: number }>, key: string) {
  if (!map.has(key)) map.set(key, { total: 0, count: 0 });
  return map.get(key)!;
}

function resolveRegionKey(name?: string): RegionKey | null {
  if (!name) return null;
  const pool: string[] = [];
  const complex = findComplex(name);
  if (complex?.region) pool.push(complex.region);
  if (complex?.name) pool.push(complex.name);
  if (Array.isArray(complex?.aliases)) pool.push(...complex.aliases);
  pool.push(name);
  if (pool.some((value) => /(?:잠원|jamwon)/i.test(value || ""))) return "jamwon";
  if (pool.some((value) => /(?:반포|banpo)/i.test(value || ""))) return "banpo";
  return null;
}

function getTxMonth(tx: DailyTxn) {
  if (tx.ym) return tx.ym;
  if (tx.date) return tx.date.slice(0, 7);
  return null;
}

function buildSeriesFromAgg(map: Map<string, { total: number; count: number }>, months: string[]): RegionSeriesPoint[] {
  return months.map((month) => {
    const entry = map.get(month);
    if (!entry || !entry.count) return { date: month, avg: null, total: 0, count: 0 };
    return { date: month, avg: entry.total / entry.count, total: entry.total, count: entry.count };
  });
}

function parseDateToTs(value?: string) {
  if (!value) return 0;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  const ym = value.slice(0, 7);
  const fallback = new Date(`${ym}-15T00:00:00Z`);
  return fallback.getTime();
}

interface RealpriceMetricsResult {
  loading: boolean;
  summary: {
    month: string;
    avg: number | null;
    prevAvg: number | null;
    changePct: number;
  } | null;
  regionSeries: Record<RegionKey, RegionSeriesPoint[]>;
  recentDeals: RecentDeal[];
  months: string[];
}

export function useJamwonBanpoRealprice(months = 12, maxRecent = 50): RealpriceMetricsResult {
  const { snap, loading } = useDailyRealprice();

  return useMemo(() => {
    const monthKeys = buildRecentMonthKeys(Math.max(1, months));
    const monthSet = new Set(monthKeys);

    const regionAgg: Record<RegionKey, Map<string, { total: number; count: number }>> = {
      jamwon: new Map(),
      banpo: new Map(),
    };

    const recentDeals: (RecentDeal & { ts: number })[] = [];
    const pricesByMonth: Map<string, { total: number; count: number }> = new Map();

    if (snap) {
      snap.transactions.forEach((tx) => {
        if (tx.type !== "sale") return; // 집합 그래프는 매매만 집계
        const month = getTxMonth(tx);
        if (!month || !monthSet.has(month)) return;
        const regionKey = resolveRegionKey(tx.complex);
        if (!regionKey) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[realprice] region unresolved:", tx.complex);
          }
          return;
        }

        const agg = ensureAgg(regionAgg[regionKey], month);
        agg.total += tx.price;
        agg.count += 1;

        const globalAgg = ensureAgg(pricesByMonth, month);
        globalAgg.total += tx.price;
        globalAgg.count += 1;

        recentDeals.push({
          complex: tx.complex,
          region: REGION_LABELS[regionKey],
          date: tx.date || `${month}-01`,
          price: tx.price,
          pyeong: tx.pyeong,
          areaM2: tx.areaM2,
          ts: parseDateToTs(tx.date || `${month}-15`),
        });
      });
    }

    const regionSeries = {
      jamwon: buildSeriesFromAgg(regionAgg.jamwon, monthKeys),
      banpo: buildSeriesFromAgg(regionAgg.banpo, monthKeys),
    };

    const recentList = recentDeals
      .sort((a, b) => b.ts - a.ts)
      .slice(0, Math.max(5, maxRecent))
      .map(({ ts, ...rest }) => rest);

    const latestMonth = [...monthKeys].reverse().find((m) => pricesByMonth.get(m)?.count);
    const prevMonth = latestMonth
      ? [...monthKeys]
          .slice(0, monthKeys.indexOf(latestMonth))
          .reverse()
          .find((m) => pricesByMonth.get(m)?.count)
      : null;

    const latestEntry = latestMonth
      ? {
          month: latestMonth,
          avg: pricesByMonth.get(latestMonth)?.total
            ? pricesByMonth.get(latestMonth)!.total / pricesByMonth.get(latestMonth)!.count
            : null,
        }
      : null;

    const prevAvg =
      prevMonth && pricesByMonth.get(prevMonth)?.count
        ? pricesByMonth.get(prevMonth)!.total / pricesByMonth.get(prevMonth)!.count
        : null;

    const summary = latestEntry
      ? {
          month: latestEntry.month,
          avg: latestEntry.avg,
          prevAvg,
          changePct: latestEntry.avg && prevAvg ? ((latestEntry.avg - prevAvg) / prevAvg) * 100 : 0,
        }
      : null;

    return {
      loading: loading && !snap,
      summary,
      regionSeries,
      recentDeals: recentList,
      months: monthKeys,
    };
  }, [snap, loading, months]);
}

function normalizeComplexName(name?: string) {
  return (name || "").trim().toLowerCase();
}

export function useComplexRecentDeals(
  complex?: string,
  max = 40,
  kind?: TxKind,
  pyeong?: number,
  areaM2?: number,
  complexId?: string,
) {
  const { snap, loading } = useDailyRealprice();

  return useMemo(() => {
    if ((!complex && !complexId) || !snap) {
      return {
        loading: loading && !snap,
        deals: [] as RecentDeal[],
      };
    }

    const normalizeName = (name?: string) =>
      (name || '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9\uac00-\ud7a3]/g, '');

    const normalizeKind = (value?: string | TxKind | null): TxKind | null => {
      const raw = String(value ?? '').toLowerCase();
      if (raw.includes('jeonse') || raw.includes('\uc804\uc138')) return 'jeonse';
      if (raw.includes('wolse') || raw.includes('\uc6d4\uc138')) return 'wolse';
      if (raw.includes('sale') || raw.includes('\ub9e4\ub9e4')) return 'sale';
      if (raw.includes('presale')) return 'presale';
      return null;
    };

    const targetKind = normalizeKind(kind);
    const targetComplex = complexId
      ? getAllComplexes().find((c) => c.id === complexId) || findComplex(complex)
      : findComplex(complex);
    const normalizedTarget = normalizeName(targetComplex?.name ?? complex);
    const targetAliases = (targetComplex?.aliases || []) as string[];
    const targetPool = new Set([normalizedTarget, ...targetAliases.map(normalizeName)].filter(Boolean));
    // fallback: 직접 전달된 complex 문자열만 있는 경우
    if (!targetPool.size && complex) {
      targetPool.add(normalizeName(complex));
    }
    const targetId = complexId || targetComplex?.id;
    const txs = snap.transactions.map((tx) => {
      const baseKind = normalizeKind((tx as any).rawType ?? tx.type);
      const monthly = (tx as any).monthly;
      const deposit = (tx as any).deposit;
      let finalKind: TxKind | null = baseKind;

      // 월세 금액이 명시되어 있으면 rawType과 무관하게 우선 wolse로 교정
      if (typeof monthly === "number" && monthly > 0) {
        finalKind = "wolse";
      } else if (typeof monthly === "number" && monthly === 0) {
        finalKind = "jeonse";
      } else if (!finalKind && typeof deposit === "number" && deposit > 0) {
        finalKind = "jeonse";
      }

      // 그래도 null이면 tx.type을 기본값으로 사용, 없으면 sale
      if (!finalKind) finalKind = normalizeKind(tx.type) ?? "sale";

      return { tx, finalKind };
    });
    const matches = txs
      .filter(({ tx, finalKind }) => {
        if (!tx.complex) return false;
        if (targetKind && finalKind !== targetKind) return false;

        const resolved = findComplex(tx.complex);
        const txName = normalizeName(resolved?.name ?? tx.complex);
        const txAliases = (resolved?.aliases || []) as string[];
        const txId = resolved?.id;
        const txPool = [txName, ...txAliases.map(normalizeName)].filter(Boolean);

        if (targetId) {
          if (!txId) return false;
          if (txId !== targetId) return false;
        }

        const nameMatched = txPool.some((n) => targetPool.has(n));
        if (!nameMatched) return false;

        // 면적/층수 등 추가 조건은 제거: 단지명/ID + 거래유형만 사용
        return true;
      })
      .map((tx) => ({
        complex: tx.tx.complex,
        type: tx.finalKind ?? tx.tx.type,
        region: resolveRegionKey(tx.tx.complex)
          ? REGION_LABELS[resolveRegionKey(tx.tx.complex) as RegionKey] || ''
          : '',
        date: tx.tx.date || `${getTxMonth(tx.tx) ?? ''}-01`,
        price: tx.tx.price,
        deposit: (tx.tx as any).deposit,
        monthly: (tx.tx as any).monthly,
        pyeong: tx.tx.pyeong,
        ts: parseDateToTs(tx.tx.date || `${getTxMonth(tx.tx) ?? ''}-15`),
      }))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, Math.max(5, max));

    return {
      loading: loading && !snap,
      deals: matches.map(({ ts, ...rest }) => rest),
    };
  }, [complex, complexId, snap, loading, max, kind]);
}
