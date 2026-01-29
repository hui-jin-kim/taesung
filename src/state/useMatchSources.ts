import { collection, onSnapshot, query, Unsubscribe } from "firebase/firestore";
import React from "react";
import { auth, db } from "../lib/firebase";
import type { BuyerMatchSnapshot, MatchEntry, MatchListing } from "../types/match";

type Store<T> = {
  rows: T[];
  version: number;
};

const listingsStore: Store<MatchListing> = { rows: [], version: 0 };
const buyerMatchesStore: Store<BuyerMatchSnapshot> = { rows: [], version: 0 };

const listingsListeners = new Set<() => void>();
const buyerMatchesListeners = new Set<() => void>();

const dirtyListings = new Set<string>();
const dirtyBuyerMatches = new Set<string>();

let listingsUnsub: Unsubscribe | null = null;
let buyerMatchesUnsub: Unsubscribe | null = null;

function hasActiveUser() {
  return Boolean(auth?.currentUser);
}

function stopListingsSubscription() {
  if (listingsUnsub) {
    listingsUnsub();
    listingsUnsub = null;
  }
}

function stopBuyerMatchesSubscription() {
  if (buyerMatchesUnsub) {
    buyerMatchesUnsub();
    buyerMatchesUnsub = null;
  }
}

function emit(listeners: Set<() => void>) {
  listeners.forEach((fn) => fn());
}

function toNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function toOwnershipType(value: unknown): "our" | "partner" | undefined {
  if (value === "our" || value === "partner") return value;
  return undefined;
}

function toStringArray(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const next = (values as unknown[]).map((v) => String(v)).filter((v) => v.length > 0);
  return next.length ? next : undefined;
}

function parseMatchEntries(values: unknown): MatchEntry[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const entries = (values as unknown[])
    .map<MatchEntry | null>((raw) => {
      const source = raw as Record<string, unknown>;
      const id = typeof source?.id === "string" ? String(source.id) : undefined;
      const score = toNumber(source?.score);
      if (!id || score == null) return null;
      const entry: MatchEntry = { id, score };
      if (typeof source?.strict === "boolean") entry.strict = Boolean(source.strict);
      return entry;
    })
    .filter((entry): entry is MatchEntry => Boolean(entry));
  return entries.length ? entries : undefined;
}

function normalizeListing(source: Record<string, unknown>, id: string): MatchListing {
  return {
    id,
    type: typeof source.type === "string" ? String(source.type) : undefined,
    area_py: toNumber(source.area_py),
    price: toNumber(source.price),
    deposit: toNumber(source.deposit),
    monthly: toNumber(source.monthly),
    status: typeof source.status === "string" ? String(source.status) : undefined,
    closedByUs: Boolean(source.closedByUs),
    deletedAt: toNumber(source.deletedAt),
    updatedAt: toNumber(source.updatedAt),
    ownershipType: toOwnershipType(source.ownershipType),
    matchedBuyerIds: toStringArray(source.matchedBuyerIds),
    matchedBuyers: parseMatchEntries(source.matchedBuyers),
    matchesUpdatedAt: toNumber((source as any).matchesUpdatedAt),
  };
}

function normalizeBuyerMatches(source: Record<string, unknown>, id: string): BuyerMatchSnapshot {
  return {
    id,
    listingIds: toStringArray(source.listingIds) ?? [],
    matches: parseMatchEntries(source.matches),
    updatedAt: toNumber(source.updatedAt),
  };
}

function ensureListingsSubscription() {
  if (listingsUnsub || !hasActiveUser()) return;
  const listingsCollection = collection(db, "match_listings");
  const q = query(listingsCollection);
  listingsUnsub = onSnapshot(q, (snapshot) => {
    const next: MatchListing[] = [];
    snapshot.forEach((docSnap) => {
      next.push(normalizeListing(docSnap.data() as Record<string, unknown>, docSnap.id));
    });
    listingsStore.rows = next;
    listingsStore.version += 1;
    snapshot.docChanges().forEach((change) => dirtyListings.add(change.doc.id));
    emit(listingsListeners);
  });
}

function ensureBuyerMatchesSubscription() {
  if (buyerMatchesUnsub || !hasActiveUser()) return;
  const ref = collection(db, "match_buyers");
  const q = query(ref);
  buyerMatchesUnsub = onSnapshot(q, (snapshot) => {
    const next: BuyerMatchSnapshot[] = [];
    snapshot.forEach((docSnap) => {
      next.push(normalizeBuyerMatches(docSnap.data() as Record<string, unknown>, docSnap.id));
    });
    buyerMatchesStore.rows = next;
    buyerMatchesStore.version += 1;
    snapshot.docChanges().forEach((change) => dirtyBuyerMatches.add(change.doc.id));
    emit(buyerMatchesListeners);
  });
}

let authListenerAttached = false;

function attachAuthListener() {
  if (authListenerAttached || !auth?.onAuthStateChanged) return;
  authListenerAttached = true;
  auth.onAuthStateChanged((user) => {
    if (user) {
      ensureListingsSubscription();
      ensureBuyerMatchesSubscription();
      emit(listingsListeners);
      emit(buyerMatchesListeners);
    } else {
      stopListingsSubscription();
      stopBuyerMatchesSubscription();
      listingsStore.rows = [];
      listingsStore.version += 1;
      buyerMatchesStore.rows = [];
      buyerMatchesStore.version += 1;
      emit(listingsListeners);
      emit(buyerMatchesListeners);
    }
  });
}

attachAuthListener();

export function getMatchListings(): MatchListing[] {
  ensureListingsSubscription();
  return listingsStore.rows;
}

export function getMatchBuyers(): BuyerMatchSnapshot[] {
  ensureBuyerMatchesSubscription();
  return buyerMatchesStore.rows;
}

export function getDirtyMatchListings() {
  ensureListingsSubscription();
  return dirtyListings;
}

export function getDirtyMatchBuyers() {
  ensureBuyerMatchesSubscription();
  return dirtyBuyerMatches;
}

export function useMatchListingsVersion() {
  ensureListingsSubscription();
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const listener = () => forceUpdate();
    listingsListeners.add(listener);
    return () => {
      listingsListeners.delete(listener);
    };
  }, []);
  return listingsStore.version;
}

export function useMatchBuyersVersion() {
  ensureBuyerMatchesSubscription();
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const listener = () => forceUpdate();
    buyerMatchesListeners.add(listener);
    return () => {
      buyerMatchesListeners.delete(listener);
    };
  }, []);
  return buyerMatchesStore.version;
}

export function clearDirtyMatchListings() {
  dirtyListings.clear();
}

export function clearDirtyMatchBuyers() {
  dirtyBuyerMatches.clear();
}

export function resetMatchSources() {
  stopListingsSubscription();
  stopBuyerMatchesSubscription();

  listingsStore.rows = [];
  listingsStore.version += 1;
  dirtyListings.clear();
  emit(listingsListeners);

  buyerMatchesStore.rows = [];
  buyerMatchesStore.version += 1;
  dirtyBuyerMatches.clear();
  emit(buyerMatchesListeners);
}
