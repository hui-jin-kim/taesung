import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";

export type CommentEntityType = "listing" | "buyer";

export type CommentDoc = {
  id: string;
  entityType: CommentEntityType;
  entityId: string;
  replyToId?: string;
  text: string;
  createdAt?: any;
  updatedAt?: any;
  createdByUid?: string;
  createdByName?: string;
  createdByEmail?: string;
  updatedByUid?: string;
  updatedByName?: string;
  updatedByEmail?: string;
};

const commentsCollection = collection(db, "comments");

function sanitize<T extends Record<string, any>>(payload: T) {
  const result: Record<string, any> = {};
  Object.keys(payload).forEach((key) => {
    const value = (payload as any)[key];
    if (value !== undefined) result[key] = value;
  });
  return result as T;
}

export function useComments(entityType: CommentEntityType, entityId: string | null) {
  const [items, setItems] = useState<CommentDoc[]>([]);

  useEffect(() => {
    if (!entityId) { setItems([]); return; }
    // 단일 구독만 유지: 정렬은 클라이언트에서 createdAt 기준으로 처리
    const qBase = query(
      commentsCollection,
      where("entityType", "==", entityType),
      where("entityId", "==", entityId),
    );
    const unsub = onSnapshot(qBase, (snap) => {
      const list: CommentDoc[] = [];
      snap.forEach((docSnap) => list.push({ id: docSnap.id, ...(docSnap.data() as any) }));
      list.sort((a: any, b: any) => {
        const av = (a?.createdAt?.toMillis?.() ?? a?.createdAt ?? 0) as number;
        const bv = (b?.createdAt?.toMillis?.() ?? b?.createdAt ?? 0) as number;
        return av - bv;
      });
      setItems(list);
    });
    return () => unsub();
  }, [entityType, entityId]);

  return items;
}

export async function createComment(
  entityType: CommentEntityType,
  entityId: string,
  text: string,
  options?: { replyToId?: string }
) {
  const user = auth.currentUser;
  const payload = sanitize({
    entityType,
    entityId,
    replyToId: options?.replyToId ?? undefined,
    text,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdByUid: user?.uid ?? undefined,
    createdByName: user?.displayName ?? user?.email ?? undefined,
    createdByEmail: user?.email ?? undefined,
    updatedByUid: user?.uid ?? undefined,
    updatedByName: user?.displayName ?? user?.email ?? undefined,
    updatedByEmail: user?.email ?? undefined,
  });
  await addDoc(commentsCollection, payload);
}

export async function updateComment(commentId: string, text: string) {
  const user = auth.currentUser;
  const ref = doc(db, "comments", commentId);
  const payload = sanitize({
    text,
    updatedAt: serverTimestamp(),
    updatedByUid: user?.uid ?? undefined,
    updatedByName: user?.displayName ?? user?.email ?? undefined,
    updatedByEmail: user?.email ?? undefined,
  });
  await updateDoc(ref, payload);
}

export async function deleteComment(commentId: string) {
  await deleteDoc(doc(db, "comments", commentId));
}
