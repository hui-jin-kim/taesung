import complexes from "../data/complexes.json";

export type Complex = {
  id: string;
  name: string;
  aliases?: string[];
  region?: string;
  tags?: string[];
  centroid?: { lat: number; lng: number };
};

function norm(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9\uac00-\ud7a3]/g, '');
}

const COMPLEXES: Complex[] = (complexes as Complex[]).map((row) => ({
  ...row,
  aliases: Array.isArray(row.aliases) ? row.aliases : undefined,
  tags: Array.isArray(row.tags) ? row.tags : undefined,
}));

const INDEX: { byKey: Record<string, Complex> } = (() => {
  const byKey: Record<string, Complex> = {};
  COMPLEXES.forEach((complex) => {
    byKey[norm(complex.name)] = complex;
    (complex.aliases || []).forEach((alias) => {
      if (!alias) return;
      byKey[norm(alias)] = complex;
    });
  });
  return { byKey };
})();

const COMPLEX_NAME_LIST = COMPLEXES.map((complex) => complex.name);

export function findComplex(name?: string): Complex | null {
  if (!name) return null;
  const key = norm(name);
  return INDEX.byKey[key] || null;
}

export function getAllComplexes(): Complex[] {
  return COMPLEXES.slice();
}

export function getComplexNames(): string[] {
  return COMPLEX_NAME_LIST.slice();
}

export function enrichListingTags(listing: any): any {
  try {
    const complex = findComplex(listing?.complex);
    if (!complex) return listing;
    const base = Array.isArray(listing?.tags) ? listing.tags.slice() : [];
    const extra = (complex.tags || []).filter((tag) => !base.includes(tag));
    return { ...listing, tags: base.concat(extra), _complex: complex };
  } catch {
    return listing;
  }
}
