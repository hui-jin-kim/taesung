import { RealPriceProvider, RealPricePoint } from "./types";

async function fetchSeries(params: { complexName?: string; from?: string; to?: string; type?: 'sale' | 'jeonse' | 'wolse'; rentFactor?: number }): Promise<RealPricePoint[]> {
  const now = new Date();
  const toYM = params.to || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fromD = new Date(now); fromD.setMonth(fromD.getMonth() - 11); fromD.setDate(1);
  const fromYM = params.from || `${fromD.getFullYear()}-${String(fromD.getMonth() + 1).padStart(2, '0')}`;
  const search = new URLSearchParams({ from: fromYM, to: toYM, type: params.type || 'sale' });
  if (params.complexName) search.set('complex', params.complexName);
  if (params.rentFactor) search.set('rentFactor', String(params.rentFactor));
  try {
    const r = await fetch(`/api/realprice/series?${search.toString()}`);
    if (!r.ok) throw new Error('bad');
    const rows = await r.json();
    return Array.isArray(rows) ? rows.map((x: any) => ({ date: x.date, price: Number(x.price) || 0 })) : [];
  } catch {
    return makeDemoSeries(fromYM, toYM);
  }
}

function makeDemoSeries(from?: string, to?: string, base = 800_000_000): RealPricePoint[] {
  const start = from ? new Date(from) : new Date(Date.now() - 150 * 24 * 60 * 60 * 1000);
  const end = to ? new Date(to) : new Date();
  start.setDate(1);
  end.setDate(1);
  const points: RealPricePoint[] = [];
  let cursor = new Date(start);
  let price = base;
  while (cursor <= end) {
    const delta = (Math.random() - 0.5) * 0.04; // ±2%
    price = Math.max(1, Math.round(price * (1 + delta)));
    const ym = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    points.push({ date: ym, price });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return points;
}

export const mlitProvider: RealPriceProvider = {
  async getSeries({ complexName, from, to }: { complexId?: string; complexName?: string; from?: string; to?: string }) {
    return fetchSeries({ complexName, from, to, type: 'sale' });
  },
};

export function getProvider(): RealPriceProvider {
  return mlitProvider;
}
