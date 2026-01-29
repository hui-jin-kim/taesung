import { RealPricePoint } from "./types";

const KEY_PREFIX = "rj_realprice_series:"; // + complexKey
const SYNC_PREFIX = "rj_realprice_lastSync:"; // + complexKey

export function saveSeries(complexKey: string, series: RealPricePoint[]) {
  try { localStorage.setItem(KEY_PREFIX + complexKey, JSON.stringify(series)); } catch {}
}

export function getSeries(complexKey: string): RealPricePoint[] | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + complexKey);
    return raw ? (JSON.parse(raw) as RealPricePoint[]) : null;
  } catch { return null; }
}

export function setLastSync(complexKey: string, when: string) {
  try { localStorage.setItem(SYNC_PREFIX + complexKey, when); } catch {}
}

export function getLastSync(complexKey: string): string | null {
  try { return localStorage.getItem(SYNC_PREFIX + complexKey); } catch { return null; }
}

