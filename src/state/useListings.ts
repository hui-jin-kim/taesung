// src/state/useListings.ts
// Firestore listings 페이징 로컬 스토어 + CRUD 동기화 헬퍼

import React from "react";
import type { Listing } from "../types/core";
import { db } from "../lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  updateDoc,
  QueryDocumentSnapshot,
  QueryConstraint,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import type { FirestoreError } from "firebase/firestore";

const PAGE_SIZE = 50;
const listingsCollection = collection(db, "listings");
const LISTINGS_CACHE_KEY = "rj:listings-cache.v1";

type Store = {
  listings: Listing[];
  version: number;
  loading: boolean;
  initialized: boolean;
  hasMore: boolean;
  lastCursor: QueryDocumentSnapshot<DocumentData> | null;
};

const store: Store = {
  listings: [],
  version: 0,
  loading: false,
  initialized: false,
  hasMore: true,
  lastCursor: null,
};

const listeners = new Set<() => void>();
const dirtyListings = new Set<string>();
let retryTimer: number | null = null;
let persistTimer: number | null = null;
let listingsUnsub: (() => void) | null = null;

function scheduleListingsCachePersist() {
  if (typeof window === "undefined") return;
  if (persistTimer != null) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    try {
      const payload = {
        ts: Date.now(),
        listings: store.listings,
        hasMore: store.hasMore,
      };
      window.localStorage.setItem(LISTINGS_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, 0);
}

function hydrateListingsCache() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LISTINGS_CACHE_KEY);
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (Array.isArray(payload?.listings)) {
      store.listings = payload.listings;
      if (typeof payload.hasMore === "boolean") store.hasMore = payload.hasMore;
    }
  } catch {
    // ignore
  }
}

function ensureRealtimeListener() {
  if (listingsUnsub) return;
  const realtimeQuery = query(listingsCollection, orderBy("createdAt", "desc"));
  listingsUnsub = onSnapshot(
    realtimeQuery,
    (snap) => {
      if (!store.initialized) return;
      let changed = false;
      snap.docChanges().forEach((change) => {
        const updated = snapshotToListing(change.doc);
        const idx = store.listings.findIndex((item) => item.id === updated.id);
        if (change.type === "removed") {
          if (idx >= 0) {
            store.listings.splice(idx, 1);
            dirtyListings.add(updated.id);
            changed = true;
          }
          return;
        }
        if (idx >= 0) store.listings.splice(idx, 1);
        store.listings.unshift(updated);
        dirtyListings.add(updated.id);
        changed = true;
      });
      if (changed) {
        store.listings.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        emit();
      }
    },
    (err) => {
      console.error("listings snapshot error", err);
    },
  );
}

function emit() {
  store.version += 1;
  scheduleListingsCachePersist();
  listeners.forEach((fn) => fn());
}

hydrateListingsCache();

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function toMillis(value: any) {
  if (!value) return undefined as number | undefined;
  try {
    return typeof value.toMillis === "function" ? value.toMillis() : Number(value) || undefined;
  } catch {
    return Number(value) || undefined;
  }
}

function snapshotToListing(docSnap: QueryDocumentSnapshot<DocumentData>): Listing {
  const data = docSnap.data() as Record<string, any>;
  return {
    id: docSnap.id,
    ...data,
    isActive: data.isActive ?? true,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    lastSavedAt: toMillis(data.lastSavedAt),
    lastSavedBy: typeof data.lastSavedBy === "string" ? data.lastSavedBy : undefined,
    lastSavedByUid: typeof data.lastSavedByUid === "string" ? data.lastSavedByUid : undefined,
    lastSavedByName: typeof data.lastSavedByName === "string" ? data.lastSavedByName : undefined,
    lastSavedByEmail: typeof data.lastSavedByEmail === "string" ? data.lastSavedByEmail : undefined,
    typeSuffix: typeof data.typeSuffix === "string" ? data.typeSuffix : undefined,
  } as Listing;
}

async function fetchPage(cursor?: QueryDocumentSnapshot<DocumentData>) {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc"), limit(PAGE_SIZE)];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(listingsCollection, ...constraints));
  const docs = snap.docs.map(snapshotToListing);
  const last = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
  return {
    docs,
    lastCursor: last,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}

async function loadInitialListings() {
  if (store.initialized || store.loading) return;
  store.loading = true;
  emit();
  try {
    ensureRealtimeListener();
    const { docs, lastCursor, hasMore } = await fetchPage();
    store.listings = docs;
    store.lastCursor = lastCursor;
    store.hasMore = hasMore;
    dirtyListings.clear();
    docs.forEach((item) => dirtyListings.add(item.id));
    store.initialized = true;
    if (retryTimer != null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  } catch (error) {
    const code = (error as FirestoreError)?.code;
    if (code === "permission-denied") {
      if (typeof window !== "undefined" && retryTimer == null) {
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          loadInitialListings().catch(() => {});
        }, 1200);
      }
    } else {
      console.error(error);
    }
    throw error;
  } finally {
    store.loading = false;
    emit();
  }
}

export async function loadMoreListings() {
  await loadInitialListings();
  if (!store.hasMore || store.loading) return;
  store.loading = true;
  emit();
  try {
    const { docs, lastCursor, hasMore } = await fetchPage(store.lastCursor ?? undefined);
    if (docs.length) {
      const seen = new Set(store.listings.map((l) => l.id));
      docs.forEach((item) => {
        if (!seen.has(item.id)) store.listings.push(item);
        dirtyListings.add(item.id);
      });
    }
    store.lastCursor = lastCursor ?? store.lastCursor;
    store.hasMore = hasMore;
  } finally {
    store.loading = false;
    emit();
  }
}

export async function reloadListings() {
  if (retryTimer != null && typeof window !== "undefined") {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  store.initialized = false;
  store.lastCursor = null;
  store.hasMore = true;
  await loadInitialListings();
}

export function useListings() {
  const getSnapshot = React.useCallback(
    () => ({ listings: store.listings, version: store.version }),
    []
  );
  const [snap, setSnap] = React.useState(getSnapshot);

  React.useEffect(() => {
    loadInitialListings().catch(() => {});
    return subscribe(() => setSnap(getSnapshot()));
  }, [getSnapshot]);

  return snap.listings.filter((l: any) => !l?.deletedAt);
}

export function useActiveListings() {
  const rows = useListings();
  return React.useMemo(
    () => rows.filter((row) => (row?.isActive ?? true) && !row?.deletedAt),
    [rows]
  );
}

export function useListingsMeta() {
  const getSnapshot = React.useCallback(
    () => ({ loading: store.loading, hasMore: store.hasMore, version: store.version }),
    []
  );
  const [snap, setSnap] = React.useState(getSnapshot);

  React.useEffect(() => subscribe(() => setSnap(getSnapshot())), [getSnapshot]);

  const loadMore = React.useCallback(() => loadMoreListings(), []);
  const reload = React.useCallback(() => reloadListings(), []);

  return {
    loading: snap.loading,
    hasMore: snap.hasMore,
    loadMore,
    reload,
  };
}

export function useListingsVersion() {
  const get = React.useCallback(() => store.version, []);
  const [v, setV] = React.useState(get());
  React.useEffect(() => subscribe(() => setV(get())), [get]);
  return v;
}

export function getListings(): Listing[] {
  return store.listings;
}

export function getDirtyListings() {
  return dirtyListings;
}

function upsertLocalListing(id: string, patch: Partial<Listing>) {
  const current = store.listings.find((item) => item.id === id);
  if (current) {
    Object.assign(current, patch, { updatedAt: Date.now() });
  }
  emit();
}

function removeLocalListing(id: string) {
  store.listings = store.listings.filter((item) => item.id !== id);
  emit();
}

function sanitize<T extends Record<string, any>>(input: T): T {
  const output: Record<string, any> = {};
  Object.keys(input).forEach((key) => {
    const value = (input as any)[key];
    if (value !== undefined) output[key] = value;
  });
  return output as T;
}

export async function updateListing(id: string, patch: Partial<Listing>) {
  store.loading = true;
  emit();
  try {
    const sanitized = sanitize({ ...patch, updatedAt: serverTimestamp() });
    await updateDoc(doc(db, "listings", id), sanitized as Record<string, unknown>);
    upsertLocalListing(id, { ...patch, updatedAt: Date.now() });
    dirtyListings.add(id);
  } finally {
    store.loading = false;
    emit();
  }
}

export async function restoreListing(
  id: string,
  previousStatus?: Listing["status"],
  extraPatch?: Partial<Listing>
) {
  store.loading = true;
  emit();
  try {
    const restoredStatus = previousStatus ?? ("active" as Listing["status"]);
    const sanitizedExtra = extraPatch ? sanitize(extraPatch as any) : {};
    if ("status" in sanitizedExtra) {
      delete (sanitizedExtra as any).status;
    }
    await updateDoc(doc(db, "listings", id), {
      closedAt: deleteField(),
      closedByUs: deleteField(),
      completedAt: deleteField(),
      isActive: true,
      deletedAt: deleteField(),
      deletedByUid: deleteField(),
      deletedByEmail: deleteField(),
      deletedReason: deleteField(),
      deletedPrevStatus: deleteField(),
      ...sanitizedExtra,
      status: restoredStatus as any,
      updatedAt: serverTimestamp(),
    });
    upsertLocalListing(id, {
      closedAt: undefined,
      closedByUs: undefined,
      completedAt: undefined,
      isActive: true,
      deletedAt: undefined,
      deletedByUid: undefined,
      deletedByEmail: undefined,
      deletedReason: undefined,
      deletedPrevStatus: undefined,
      ...sanitizedExtra,
      status: restoredStatus as any,
    });
    dirtyListings.add(id);
  } finally {
    store.loading = false;
    emit();
  }
}

export async function removeListing(id: string) {
  store.loading = true;
  emit();
  try {
    await deleteDoc(doc(db, "listings", id));
    removeLocalListing(id);
    dirtyListings.add(id);
  } finally {
    store.loading = false;
    emit();
  }
}
