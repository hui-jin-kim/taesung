import details from "../data/complexDetails.json";
import { findComplex } from "./complexIndex";

export type ComplexDetail = {
  name: string;
  aliases?: string[];
  summary?: string;
  builtYear?: number;
  supplyArea?: string;
  exclusiveArea?: string;
  parking?: string;
  heating?: string;
  entrance?: string;
  managementFee?: string;
  households?: string;
  floors?: string;
  ban?: string;
  nearby?: string;
  notes?: string;
};

const byKey: Record<string, ComplexDetail> = (() => {
  const map: Record<string, ComplexDetail> = {};
  (details as ComplexDetail[]).forEach((item) => {
    const baseKey = normalize(item.name);
    if (baseKey) map[baseKey] = item;
    (item.aliases || []).forEach((alias) => {
      const key = normalize(alias);
      if (key) map[key] = item;
    });
  });
  return map;
})();

function normalize(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function findComplexDetail(name?: string): ComplexDetail | null {
  if (!name) return null;
  const base = byKey[normalize(name)];
  if (base) return base;
  const matched = findComplex(name);
  if (!matched) return null;
  const fallback = byKey[normalize(matched.name)];
  if (fallback) return fallback;
  const alias = (matched.aliases || []).map((text) => byKey[normalize(text)]).find(Boolean);
  return alias ?? null;
}
