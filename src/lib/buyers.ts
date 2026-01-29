import React from "react";
import { Buyer } from "../types/buyer";
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
} from "firebase/firestore";
import { auth, db } from "./firebase";

const buyersCollection = collection(db, "buyers");

function sanitize<T extends Record<string, any>>(input: T): T {
  const out: Record<string, any> = {};
  Object.keys(input).forEach((k) => {
    const v = (input as any)[k];
    if (v !== undefined) out[k] = v;
  });
  return out as T;
}

function buildKeywordsSafe(snapshot: Partial<Buyer>) {
  const source = [
    snapshot.name,
    (snapshot as any).ownerName,
    (snapshot as any).phone,
    (snapshot as any).assignedTo,
    (snapshot as any).notes,
    (snapshot as any).budgetText,
    ...(snapshot.typePrefs ?? []),
    ...(snapshot.complexPrefs ?? []),
    ...(snapshot.mustHaves ?? []),
    ...(snapshot.areaPrefsPy ?? []).map((x) => String(x)),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return Array.from(new Set(source.split(/[\s,\/]+/g).filter(Boolean)));
}

export function useBuyers() {
  const [rows, setRows] = React.useState<Buyer[]>([]);

  React.useEffect(() => {
    const q = query(buyersCollection, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: Buyer[] = [];
      snap.forEach((s) => list.push({ id: s.id, ...(s.data() as any) }));
      setRows(list);
    });
    return () => unsub();
  }, []);

  return rows;
}

export function findBuyer(rows: Buyer[], id?: string | null) {
  if (!id) return undefined;
  return rows.find((b) => b.id === id);
}

export async function createBuyer(input: Partial<Buyer> & { name: string }) {
  const user = auth.currentUser;
  const payload = sanitize({
    name: input.name,
    phone: input.phone ?? "",
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdByUid: user?.uid ?? undefined,
    createdByEmail: user?.email ?? undefined,
    updatedByUid: user?.uid ?? undefined,
    updatedByEmail: user?.email ?? undefined,
    keywords: buildKeywordsSafe(input),
  } as any);
  const ref = await addDoc(buyersCollection, payload);
  return ref.id;
}

export async function updateBuyer(id: string, patch: Partial<Buyer>) {
  const user = auth.currentUser;
  const ref = doc(db, "buyers", id);
  const next: any = sanitize({ ...patch, updatedAt: serverTimestamp() });
  if (user) {
    next.updatedByUid = user.uid;
    next.updatedByEmail = user.email ?? undefined;
  }
  // keywords 재계산: 관련 필드 변경 시
  if (
    patch.name != null ||
    (patch as any).phone != null ||
    (patch as any).ownerName != null ||
    patch.assignedTo != null ||
    patch.notes != null ||
    (patch as any).budgetText != null ||
    patch.typePrefs != null ||
    patch.complexPrefs != null ||
    patch.mustHaves != null ||
    patch.areaPrefsPy != null
  ) {
    next.keywords = buildKeywordsSafe(patch as any);
  }
  await updateDoc(ref, next);
}

export async function removeBuyer(id: string) {
  await deleteDoc(doc(db, "buyers", id));
}
