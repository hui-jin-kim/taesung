import React from "react";

const LS_KEY = "rj_buyer_match_memory";

export type BuyerMatchMemoryEntry = {
  ids: string[];
  updatedAt: number;
};

export type BuyerMatchMemory = Record<string, BuyerMatchMemoryEntry>;
type Listener = () => void;

function dedupe(ids: string[]) {
  return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.length > 0)));
}

function load(): BuyerMatchMemory {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, { ids?: unknown; updatedAt?: unknown }>;
    const store: BuyerMatchMemory = {};
    Object.entries(parsed).forEach(([buyerId, value]) => {
      if (!value || !Array.isArray((value as any).ids)) return;
      const ids = dedupe((value as any).ids as string[]);
      if (ids.length === 0) return;
      store[buyerId] = { ids, updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : Date.now() };
    });
    return store;
  } catch {
    return {};
  }
}

let store: BuyerMatchMemory = load();
const listeners = new Set<Listener>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore individual listener errors */
    }
  });
}

export function subscribeBuyerMatchMemory(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBuyerMatchIds(buyerId: string) {
  const entry = store[buyerId];
  return entry ? entry.ids.slice() : [];
}

export function rememberBuyerMatches(buyerId: string, listingIds: string[]) {
  if (!buyerId) return;
  const ids = dedupe(listingIds);
  if (ids.length === 0) {
    if (store[buyerId]) {
      delete store[buyerId];
      persist();
      emit();
    }
    return;
  }
  store = {
    ...store,
    [buyerId]: {
      ids,
      updatedAt: Date.now(),
    },
  };
  persist();
  emit();
}

export function clearBuyerMatches(buyerId: string) {
  if (!buyerId || !store[buyerId]) return;
  const next = { ...store };
  delete next[buyerId];
  store = next;
  persist();
  emit();
}

export function useBuyerMatchMemory(): BuyerMatchMemory {
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => subscribeBuyerMatchMemory(() => forceUpdate()), []);
  return store;
}
