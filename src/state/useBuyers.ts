// src/state/useBuyers.ts
// Firestore buyers 구독 + 로컬 캐시/더티 추적

import React from "react";
import type { Buyer } from "../types/core";
import { auth, db } from "../lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  deleteField,
} from "firebase/firestore";

type Store = {
  buyers: Buyer[];
  version: number;
};

const buyersCollection = collection(db, "buyers");
const BUYERS_CACHE_KEY = "rj:buyers-cache.v1";
const store: Store = { buyers: [], version: 0 };
const listeners = new Set<() => void>();
const dirtyBuyers = new Set<string>();
let unsubscribe: (() => void) | null = null;
let previousIds = new Set<string>();
let buyersPersistTimer: number | null = null;

function scheduleBuyersCachePersist() {
  if (typeof window === "undefined") return;
  if (buyersPersistTimer != null) return;
  buyersPersistTimer = window.setTimeout(() => {
    buyersPersistTimer = null;
    try {
      const payload = { ts: Date.now(), buyers: store.buyers };
      window.localStorage.setItem(BUYERS_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, 0);
}

function hydrateBuyersCache() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(BUYERS_CACHE_KEY);
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (Array.isArray(payload?.buyers)) {
      store.buyers = payload.buyers;
    }
  } catch {
    // ignore
  }
}

function emit() {
  store.version += 1;
  scheduleBuyersCachePersist();
  listeners.forEach((fn) => fn());
}

hydrateBuyersCache();

function ensureSubscription() {
  if (unsubscribe) return;
  const q = query(buyersCollection, orderBy("createdAt", "desc"));
  unsubscribe = onSnapshot(q, (snap) => {
    const list: Buyer[] = [];
    const nextIds = new Set<string>();
    snap.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, any>;
      if (!data?.deletedAt) {
        list.push({ id: docSnap.id, ...data } as Buyer);
      }
      nextIds.add(docSnap.id);
      dirtyBuyers.add(docSnap.id);
    });
    previousIds.forEach((id) => {
      if (!nextIds.has(id)) dirtyBuyers.add(id);
    });
    previousIds = nextIds;
    store.buyers = list;
    emit();
  });
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useBuyers() {
  ensureSubscription();
  const getSnapshot = React.useCallback(
    () => ({ buyers: store.buyers, version: store.version }),
    []
  );
  const [snap, setSnap] = React.useState(getSnapshot);

  React.useEffect(() => subscribe(() => setSnap(getSnapshot())), [getSnapshot]);

  return snap.buyers;
}

// Trash (deleted buyers) subscription — returns only documents with deletedAt > 0
export function useTrashBuyers() {
  const [rows, setRows] = React.useState<Buyer[]>([]);
  React.useEffect(() => {
    const qy = query(
      buyersCollection,
      where("deletedAt", ">", 0),
      orderBy("deletedAt", "desc") as any,
    );
    const unsub = onSnapshot(qy, (snap) => {
      const list: Buyer[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        list.push({ id: docSnap.id, ...data } as Buyer);
      });
      setRows(list);
    });
    return () => unsub();
  }, []);
  return rows;
}

export function useBuyersVersion() {
  const get = React.useCallback(() => store.version, []);
  const [v, setV] = React.useState(get());
  React.useEffect(() => subscribe(() => setV(get())), [get]);
  return v;
}

export function getBuyers(): Buyer[] {
  ensureSubscription();
  return store.buyers;
}

export function getDirtyBuyers() {
  return dirtyBuyers;
}

function sanitize<T extends Record<string, any>>(input: T): T {
  const output: Record<string, any> = {};
  Object.keys(input).forEach((key) => {
    const value = (input as any)[key];
    if (value !== undefined) output[key] = value;
  });
  return output as T;
}

function buildKeywords(snapshot: Partial<Buyer>) {
  const source = [
    snapshot.name,
    snapshot.ownerName,
    snapshot.phone,
    snapshot.assignedTo,
    snapshot.notes,
    snapshot.budgetText,
    ...(snapshot.typePrefs ?? []),
    ...(snapshot.complexPrefs ?? []),
    ...(snapshot.mustHaves ?? []),
    ...(snapshot.areaPrefsPy ?? []).map((v) => String(v)),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return Array.from(new Set(source.split(/[\s,\/]+/g).filter(Boolean)));
}

type CreateBuyerInput = Partial<Buyer> & { name: string; receivedDate?: string };

export async function createBuyer(input: CreateBuyerInput) {
  const user = auth.currentUser;
  const payload = sanitize({
    name: input.name,
    phone: input.phone ?? "",
    receivedDate: input.receivedDate ?? new Date().toISOString().slice(0,10),
    budgetMin: input.budgetMin ?? undefined,
    budgetMax: input.budgetMax ?? undefined,
    monthlyMax: input.monthlyMax ?? undefined,
    budgetText: (input as any).budgetText ?? undefined,
    typePrefs: input.typePrefs ?? [],
    areaPrefsPy: input.areaPrefsPy ?? [],
    complexPrefs: input.complexPrefs ?? [],
    floors: input.floors ?? [],
    mustHaves: input.mustHaves ?? [],
    notes: input.notes ?? "",
    assignedTo: input.assignedTo ?? user?.uid ?? user?.email ?? "",
    assignedToName: input.assignedToName ?? undefined,
    assignedToEmail: input.assignedToEmail ?? undefined,
    ownerName: input.ownerName ?? undefined,
    status: input.status ?? "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdByUid: user?.uid ?? undefined,
    createdByEmail: user?.email ?? undefined,
    updatedByUid: user?.uid ?? undefined,
    updatedByEmail: user?.email ?? undefined,
    keywords: buildKeywords(input),
  });
  const ref = await addDoc(buyersCollection, payload);
  dirtyBuyers.add(ref.id);
  return ref.id;
}

export async function updateBuyer(id: string, patch: Partial<Buyer>) {
  const user = auth.currentUser;
  const ref = doc(db, "buyers", id);
  const next: Record<string, any> = sanitize({
    ...patch,
    updatedAt: serverTimestamp(),
  });
  if (user) {
    next.updatedByUid = user.uid;
    next.updatedByEmail = user.email ?? undefined;
  }
  if (
    patch.name != null ||
    patch.ownerName != null ||
    patch.phone != null ||
    patch.assignedTo != null ||
    patch.notes != null ||
    patch.budgetText != null ||
    patch.typePrefs != null ||
    patch.complexPrefs != null ||
    patch.mustHaves != null ||
    patch.areaPrefsPy != null ||
    patch.monthlyMax != null
  ) {
    next.keywords = buildKeywords({ ...getBuyers().find((b) => b.id === id), ...patch });
  }
  await updateDoc(ref, next);
  dirtyBuyers.add(id);
}

export async function removeBuyer(id: string) {
  await deleteDoc(doc(db, "buyers", id));
  dirtyBuyers.add(id);
}

export async function restoreBuyer(id: string) {
  const user = auth.currentUser;
  const ref = doc(db, "buyers", id);
  const payload: Record<string, any> = {
    deletedAt: deleteField(),
    deletedByUid: deleteField(),
    deletedByEmail: deleteField(),
    deletedReason: deleteField(),
    status: "active",
    updatedAt: serverTimestamp(),
  };
  if (user) {
    payload.updatedByUid = user.uid;
    payload.updatedByEmail = user.email ?? undefined;
  }
  await updateDoc(ref, payload);
  dirtyBuyers.add(id);
}
