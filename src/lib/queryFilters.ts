export type QueryFilters = {
  priceMax?: number; priceMin?: number;
  type?: '매매'|'전세'|'월세';
  pyMin?: number; pyMax?: number;
  region?: string; river?: boolean;
  floorBand?: '저층'|'중층'|'고층';
  q?: string;
};

export function parseQuery(text: string): QueryFilters {
  const t = String(text || '').trim();
  if (!t) return {};
  const price = t.match(/(\d+)\s*억/); // 20억
  const py = t.match(/(\d+)\s*평/);    // 33평
  const band = /(저층|중층|고층)/.exec(t)?.[1] as any;
  const type = /(매입|매수|매매)/.test(t) ? '매매' : /(전세)/.test(t) ? '전세' : /(월세)/.test(t) ? '월세' : undefined;
  const region = /(잠원|반포|서초|강남)/.exec(t)?.[1];
  const river = /(한강|한강변|리버)/.test(t);
  return {
    priceMax: price ? parseInt(price[1],10)*100_000_000 : undefined,
    type,
    pyMin: py ? parseInt(py[1],10) : undefined,
    pyMax: py ? parseInt(py[1],10) : undefined,
    region, river,
    floorBand: band,
    q: t,
  };
}

function bandFloor(text?: string): '저층'|'중층'|'고층' {
  if (!text) return '중층';
  const m = text.match(/(\d+)(?:\/(\d+))?/);
  if (!m) return '중층';
  const cur = parseInt(m[1],10); const tot = m[2]?parseInt(m[2],10):undefined;
  if (tot && tot>=24) { const r=cur/tot; return r<=.33?'저층':r>=.67?'고층':'중층'; }
  if (cur<=8) return '저층'; if (cur>=17) return '고층'; return '중층';
}

export function matches(l: any, f: QueryFilters): boolean {
  const okPriceMin = f.priceMin ? (l.price||0) >= f.priceMin : true;
  const okPriceMax = f.priceMax ? (l.price||0) <= f.priceMax : true;
  const okType = f.type ? String(l.type||'') === f.type : true;
  const pyVal = l.py || l.area_py || 0;
  const okPyMin = f.pyMin ? pyVal >= f.pyMin : true;
  const okPyMax = f.pyMax ? pyVal <= f.pyMax : true;
  const blob = `${l.complex||''} ${l.address||''} ${(l.tags||[]).join(' ')}`;
  const okRegion = f.region ? blob.includes(f.region) : true;
  const okRiver = f.river ? /한강|리버|리버뷰|반포|잠원/.test(blob) : true;
  const okBand = f.floorBand ? bandFloor(l.floor||'')===f.floorBand : true;
  const okQ = f.q ? blob.toLowerCase().includes(f.q.toLowerCase()) : true;
  return okPriceMin && okPriceMax && okType && okPyMin && okPyMax && okRegion && okRiver && okBand && okQ;
}

export function score(l: any, f: QueryFilters): number {
  let s = 0;
  if (f.type && String(l.type||'')===f.type) s+=2;
  if (f.priceMax) s += Math.max(0, 2 - Math.abs((l.price||0) - f.priceMax)/Math.max(1,f.priceMax));
  if (f.pyMin) s += Math.max(0, 2 - Math.abs((l.py||l.area_py||0) - f.pyMin)/Math.max(1,f.pyMin));
  if (f.region && (`${l.address||''}${l.complex||''}`).includes(f.region)) s+=1;
  if (f.river && /한강|리버|리버뷰|반포|잠원/.test(`${(l.tags||[]).join(' ')} ${l.address||''}`)) s+=1;
  if (f.floorBand && bandFloor(l.floor||'')===f.floorBand) s+=1;
  return s;
}

