// src/lib/storage.ts
import type { Listing } from "../types/listing";

const LS_KEY = "rj_listings";

export function readLocal(): Listing[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Listing[]) : [];
  } catch {
    return [];
  }
}

export function writeLocal(items: Listing[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

// Local-only helpers (no sample merge)
export function upsertLocal(next: Listing) {
  const all = readLocal();
  const idx = all.findIndex((x) => x.id === next.id);
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  writeLocal(all);
}

export function removeLocalById(id: string) {
  const remained = readLocal().filter((x) => x.id !== id);
  writeLocal(remained);
}

export function getAllMerged(sample: Listing[], sampleIds: Set<string>) {
  const custom = readLocal();
  const map = new Map<string, Listing>();
  sample.forEach((x) => map.set(x.id, x));
  custom.forEach((x) => map.set(x.id, x)); // ?ъ슜???곗꽑
  return Array.from(map.values());
}

export function upsert(one: Listing, sampleIds: Set<string>, sample: Listing[]) {
  const all = getAllMerged(sample, sampleIds);
  const idx = all.findIndex((x) => x.id === one.id);
  if (idx >= 0) all[idx] = one;
  else all.push(one);
  const onlyCustom = all.filter((x) => !sampleIds.has(x.id));
  writeLocal(onlyCustom);
}

export function removeByIds(ids: string[], sampleIds: Set<string>, sample: Listing[]) {
  const all = getAllMerged(sample, sampleIds);
  const remained = all.filter((x) => !ids.includes(x.id));
  const onlyCustom = remained.filter((x) => !sampleIds.has(x.id));
  writeLocal(onlyCustom);
}

