import schools from "../data/pois/schools.json";
import stations from "../data/pois/stations.json";

type Poi = { name: string; aliases?: string[]; lat: number; lng: number; type: 'school'|'station' };

const POIS: Poi[] = [
  ...(schools as any[]).map((p)=>({ ...p, type: 'school' as const })),
  ...(stations as any[]).map((p)=>({ ...p, type: 'station' as const })),
];

function norm(s: string) {
  return String(s||'').toLowerCase().replace(/\s+/g,'');
}

export function findPoiByName(text?: string): Poi | null {
  if (!text) return null;
  const t = norm(text);
  let best: {poi: Poi; score: number} | null = null;
  for (const p of POIS) {
    const names = [p.name].concat(p.aliases||[]).map(norm);
    for (const n of names) {
      if (!n) continue;
      if (t.includes(n)) {
        const sc = n.length;
        if (!best || sc > best.score) best = { poi: p, score: sc };
      }
    }
  }
  return best?.poi || null;
}

