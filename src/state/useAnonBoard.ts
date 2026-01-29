import React from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Unsubscribe,
  doc,
  deleteDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export type AnonPost = {
  id: string;
  title: string;
  content: string;
  nickname?: string;
  contact?: string;
  email?: string;
  uid?: string;
  status?: "pending" | "answered";
  viewCount?: number;
  adminReply?: string;
  adminReplyAt?: number;
  createdAt?: number;
  updatedAt?: number;
};

export type AnonComment = {
  id: string;
  postId: string;
  replyToId?: string;
  message: string;
  nickname?: string;
  listingTitle?: string;
  listingUnit?: string;
  listingPy?: string | number;
  listingType?: string;
  listingPriceText?: string;
  listingId?: string;
  email?: string;
  uid?: string;
  createdAt?: number;
};

const postsCol = collection(db, "anonPosts");
const commentsCol = collection(db, "anonComments");

type Store = {
  posts: AnonPost[];
  comments: AnonComment[];
  version: number;
};

const store: Store = { posts: [], comments: [], version: 0 };
const listeners = new Set<() => void>();
let unsubPosts: Unsubscribe | null = null;
let unsubComments: Unsubscribe | null = null;

function toMillis(val: any) {
  try {
    return typeof val?.toMillis === "function" ? val.toMillis() : Number(val) || undefined;
  } catch {
    return Number(val) || undefined;
  }
}

function emit() {
  store.version += 1;
  listeners.forEach((fn) => fn());
}

function cleanPayload<T extends Record<string, any>>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function ensureSubscriptions() {
  if (!unsubPosts) {
    const q = query(postsCol, orderBy("createdAt", "desc"));
    unsubPosts = onSnapshot(
      q,
      (snap) => {
        store.posts = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            ...data,
            createdAt: toMillis(data.createdAt),
            updatedAt: toMillis(data.updatedAt),
            adminReplyAt: toMillis(data.adminReplyAt),
            viewCount: typeof data.viewCount === "number" ? data.viewCount : 0,
          } as AnonPost;
        });
        emit();
      },
      (err) => console.error("anonPosts snapshot error", err),
    );
  }
  if (!unsubComments) {
    const q = query(commentsCol, orderBy("createdAt", "asc"));
    unsubComments = onSnapshot(
      q,
      (snap) => {
        store.comments = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            ...data,
            createdAt: toMillis(data.createdAt),
          } as AnonComment;
        });
        emit();
      },
      (err) => console.error("anonComments snapshot error", err),
    );
  }
}

export function useAnonBoard() {
  ensureSubscriptions();
  const get = React.useCallback(
    () => ({ posts: store.posts, comments: store.comments, version: store.version }),
    [],
  );
  const [snap, setSnap] = React.useState(get);
  React.useEffect(() => {
    const listener = () => setSnap(get());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [get]);

  return snap;
}

export async function createAnonPost(input: Omit<AnonPost, "id" | "createdAt">) {
  const payload = cleanPayload({
    ...input,
    status: input.status ?? "pending",
    viewCount: input.viewCount ?? 0,
    createdAt: serverTimestamp(),
  });
  const ref = await addDoc(postsCol, payload);
  return ref.id;
}

export async function updateAnonPost(id: string, patch: Partial<AnonPost>) {
  if (!id) return;
  const payload = cleanPayload({
    ...patch,
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(postsCol, id), payload);
}

export async function incrementAnonPostView(id: string) {
  if (!id) return;
  await updateDoc(doc(postsCol, id), { viewCount: increment(1) });
}

export async function deleteAnonPost(id: string) {
  if (!id) return;
  await deleteDoc(doc(postsCol, id));
}

export async function createAnonComment(input: Omit<AnonComment, "id" | "createdAt">) {
  const payload = cleanPayload({
    ...input,
    createdAt: serverTimestamp(),
  });
  const ref = await addDoc(commentsCol, payload);
  return ref.id;
}

export async function deleteAnonComment(id: string) {
  if (!id) return;
  await deleteDoc(doc(commentsCol, id));
}

export function useCommentsForPost(postId: string) {
  ensureSubscriptions();
  const get = React.useCallback(
    () => ({
      comments: store.comments.filter((c) => c.postId === postId),
      version: store.version,
    }),
    [postId],
  );
  const [snap, setSnap] = React.useState(get);
  React.useEffect(() => {
    const listener = () => setSnap(get());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [get]);
  return snap.comments;
}
