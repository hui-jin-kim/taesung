import { auth, db } from "./firebase";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";

export type BuyerLeadDoc = {
  id: string;
  name: string;
  type: "매수" | "임차" | string;
  status: "active" | "in_progress" | "matched";
  phone?: string;
  email?: string;
  channel?: string;
  preferredArea?: string;
  budget?: string;
  requirements?: string;
  memo?: string;
  nextAction?: string;
  assigneeUid?: string;
  assigneeName?: string;
  createdAt?: any;
  updatedAt?: any;
  createdByUid?: string;
  createdByName?: string;
  createdByEmail?: string;
  updatedByUid?: string;
  updatedByName?: string;
  updatedByEmail?: string;
};

const col = collection(db, "buyerLeads");

function sanitize<T extends Record<string, any>>(obj: T): T {
  const copy: any = {};
  Object.keys(obj).forEach((key) => {
    const value = (obj as any)[key];
    if (value !== undefined) copy[key] = value;
  });
  return copy as T;
}

export function useBuyerLeads() {
  const [rows, setRows] = useState<BuyerLeadDoc[]>([]);
  useEffect(() => {
    const q = query(col, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: BuyerLeadDoc[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      setRows(list);
    });
    return () => unsub();
  }, []);
  return rows;
}

export async function createBuyerLead(input: Partial<BuyerLeadDoc> & { name: string; type: BuyerLeadDoc["type"] }) {
  const user = auth.currentUser;
  const payload = sanitize({
    name: input.name,
    type: input.type ?? "매수",
    status: input.status ?? "active",
    phone: input.phone ?? "",
    email: input.email ?? "",
    channel: input.channel ?? "",
    preferredArea: input.preferredArea ?? "",
    budget: input.budget ?? "",
    requirements: input.requirements ?? "",
    memo: input.memo ?? "",
    nextAction: input.nextAction ?? "",
    assigneeUid: input.assigneeUid ?? "",
    assigneeName: input.assigneeName ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdByUid: input.createdByUid ?? user?.uid ?? undefined,
    createdByName: input.createdByName ?? user?.displayName ?? user?.email ?? undefined,
    createdByEmail: input.createdByEmail ?? user?.email ?? undefined,
    updatedByUid: input.updatedByUid ?? user?.uid ?? undefined,
    updatedByName: input.updatedByName ?? user?.displayName ?? user?.email ?? undefined,
    updatedByEmail: input.updatedByEmail ?? user?.email ?? undefined,
  } as Partial<BuyerLeadDoc>);
  const ref = await addDoc(col, payload);
  return ref.id;
}

export async function updateBuyerLead(id: string, patch: Partial<BuyerLeadDoc>) {
  const user = auth.currentUser;
  const ref = doc(db, "buyerLeads", id);
  const next: any = sanitize({
    ...patch,
    updatedAt: serverTimestamp(),
  });
  if (user) {
    next.updatedByUid = user.uid;
    next.updatedByEmail = user.email ?? undefined;
    next.updatedByName = user.displayName ?? user.email ?? undefined;
  } else if (
    patch.updatedByUid != null ||
    patch.updatedByEmail != null ||
    patch.updatedByName != null
  ) {
    next.updatedByUid = patch.updatedByUid ?? undefined;
    next.updatedByEmail = patch.updatedByEmail ?? undefined;
    next.updatedByName = patch.updatedByName ?? undefined;
  }
  await updateDoc(ref, next);
}

export async function removeBuyerLead(id: string) {
  await deleteDoc(doc(db, "buyerLeads", id));
}
