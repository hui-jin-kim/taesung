const STORAGE_KEY = "rj:match-buffer";

type BufferStore = Record<string, { ids: string[]; savedAt: number }>;

function readStore(): BufferStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const store: BufferStore = {};
    Object.entries(parsed as Record<string, any>).forEach(([key, value]) => {
      if (!value || !Array.isArray((value as any).ids)) return;
      store[key] = {
        ids: (value as any).ids.filter((id: unknown) => typeof id === "string"),
        savedAt: typeof (value as any).savedAt === "number" ? (value as any).savedAt : Date.now(),
      };
    });
    return store;
  } catch {
    return {};
  }
}

function writeStore(store: BufferStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function storeMatchBuffer(buyerId: string, listingIds: string[]) {
  if (!buyerId) return;
  const ids = Array.from(new Set(listingIds.filter((id) => typeof id === "string" && id.length > 0)));
  if (ids.length === 0) return;
  const store = readStore();
  store[buyerId] = { ids, savedAt: Date.now() };
  writeStore(store);
}

export function consumeMatchBuffer(buyerId?: string | null): string[] | null {
  if (!buyerId) return null;
  const store = readStore();
  const entry = store[buyerId];
  if (!entry) return null;
  delete store[buyerId];
  writeStore(store);
  return Array.isArray(entry.ids) ? entry.ids.slice() : null;
}

export function clearMatchBuffer(buyerId?: string | null) {
  if (!buyerId) return;
  const store = readStore();
  if (!store[buyerId]) return;
  delete store[buyerId];
  writeStore(store);
}
