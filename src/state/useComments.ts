// src/state/useComments.ts
// 로컬 댓글 상태 관리 + 비고 동기화 로직

import React from "react";
import type { Comment, NotesSyncMode } from "../types/core";
import { useAuth } from "../context/AuthContext";
import { updateBuyer as updateBuyerState } from "./useBuyers";
import { updateListing as updateListingState } from "./useListings";
import { triggerDirtyFor } from "./useMatches";
import { syncCommentToParent } from "../lib/notesSync";

type Store = {
  comments: Comment[];
  mode: NotesSyncMode;
};

const store: Store = { comments: [], mode: "last" };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function cascadeRemove(targetId: string) {
  const queue = [targetId];
  const removed: Comment[] = [];

  while (queue.length) {
    const current = queue.pop();
    if (!current) continue;

    const item = store.comments.find((c) => c.id === current);
    if (!item) continue;

    removed.push(item);
    queue.push(
      ...store.comments
        .filter((c) => c.replyToId === current)
        .map((c) => c.id)
    );

    store.comments = store.comments.filter((c) => c.id !== current);
  }

  return removed;
}

function syncLatestFor(row: Comment) {
  if (row.replyToId || !row.syncToNotes) return;

  const siblings = store.comments
    .filter(
      (c) =>
        c.parentType === row.parentType &&
        c.parentId === row.parentId &&
        c.syncToNotes &&
        !c.replyToId
    )
    .sort((a, b) => b.createdAt - a.createdAt);

  const latest = siblings[0];
  if (latest) {
    syncCommentToParent(row.parentType, row.parentId, latest, store.mode, {
      updateBuyer: updateBuyerState,
      updateListing: updateListingState,
      triggerDirty: triggerDirtyFor,
    });
    return;
  }

  if (row.parentType === "buyer") {
    updateBuyerState(row.parentId, {
      notes: "",
      lastCommentText: "",
      lastCommentAt: undefined,
      lastCommentAuthor: undefined,
    });
  } else {
    updateListingState(row.parentId, {
      memo: "",
      lastCommentText: "",
      lastCommentAt: undefined,
      lastCommentAuthor: undefined,
    });
  }
  triggerDirtyFor(row.parentType, row.parentId);
}

export function useComments() {
  const snapshot = React.useCallback(
    () => ({ comments: store.comments, mode: store.mode }),
    []
  );
  const [snap, setSnap] = React.useState(snapshot());
  const { user } = useAuth();

  React.useEffect(() => subscribe(() => setSnap(snapshot())), [snapshot]);

  function listByParent(parentType: "listing" | "buyer", parentId: string) {
    return snap.comments
      .filter((c) => c.parentType === parentType && c.parentId === parentId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  function add(input: Omit<Comment, "id" | "createdAt" | "updatedAt">) {
    const now = Date.now();
    const id = `c_${Math.random().toString(36).slice(2, 9)}`;
    const row: Comment = { id, createdAt: now, ...input };
    store.comments = [...store.comments, row];
    emit();

    if (row.syncToNotes && !row.replyToId) {
      syncCommentToParent(row.parentType, row.parentId, row, store.mode, {
        updateBuyer: updateBuyerState,
        updateListing: updateListingState,
        triggerDirty: triggerDirtyFor,
      });
    }

    return id;
  }

  function update(id: string, patch: Partial<Comment>) {
    const now = Date.now();
    store.comments = store.comments.map((c) =>
      c.id === id ? { ...c, ...patch, updatedAt: now } : c
    );
    emit();

    const row = store.comments.find((c) => c.id === id);
    if (!row) return;

    const touchedSyncField =
      patch.text != null || patch.syncToNotes != null || patch.replyToId != null;
    if (touchedSyncField && row.syncToNotes && !row.replyToId) {
      syncCommentToParent(row.parentType, row.parentId, row, store.mode, {
        updateBuyer: updateBuyerState,
        updateListing: updateListingState,
        triggerDirty: triggerDirtyFor,
      });
    }
  }

  function remove(id: string) {
    const removed = cascadeRemove(id);
    if (removed.length === 0) return;
    emit();
    removed.forEach((row) => syncLatestFor(row));
  }

  function setNotesSyncMode(mode: NotesSyncMode) {
    store.mode = mode;
    emit();
  }

  function getNotesSyncMode() {
    return store.mode;
  }

  return {
    listByParent,
    add,
    update,
    remove,
    setNotesSyncMode,
    getNotesSyncMode,
    user,
  } as const;
}
