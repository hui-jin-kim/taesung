// src/lib/notesSync.ts
// 비고(요약) 동기화 유틸. (로컬 상태, Firestore 동기화와 연동 가정)

import type { Buyer, Listing, Comment, NotesSyncMode } from "../types/core";

export function formatNoteLine(c: Comment): string {
  const t = String(c.text)
    .replace(/<[^>]+>/g, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();
  const cut = t.length > 120 ? t.slice(0, 120) + "…" : t;
  const ts = new Date(c.createdAt);
  const tsText = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}-${String(ts.getDate()).padStart(2, "0")} ${String(ts.getHours()).padStart(2, "0")}:${String(ts.getMinutes()).padStart(2, "0")}`;
  return `[${c.authorName} · ${tsText}] ${cut}`;
}

export function syncCommentToParent(
  parentType: "listing" | "buyer",
  parentId: string,
  comment: Comment,
  mode: NotesSyncMode,
  deps: {
    updateBuyer: (id: string, patch: Partial<Buyer>) => void;
    updateListing: (id: string, patch: Partial<Listing>) => void;
    triggerDirty: (t: "listing" | "buyer", id: string) => void;
  }
) {
  const line = formatNoteLine(comment);
  if (parentType === "buyer") {
    if (mode === "last") {
      deps.updateBuyer(parentId, {
        notes: line,
        lastCommentText: comment.text,
        lastCommentAt: comment.createdAt,
        lastCommentAuthor: comment.authorName,
      });
    } else {
      deps.updateBuyer(parentId, ((prev: any) => ({ notes: undefined })) as any);
      deps.updateBuyer(parentId, {
        notes: line,
        lastCommentText: comment.text,
        lastCommentAt: comment.createdAt,
        lastCommentAuthor: comment.authorName,
      });
    }
    deps.triggerDirty("buyer", parentId);
  } else {
    if (mode === "last") {
      deps.updateListing(parentId, {
        memo: line,
        lastCommentText: comment.text,
        lastCommentAt: comment.createdAt,
        lastCommentAuthor: comment.authorName,
      });
    } else {
      deps.updateListing(parentId, ((prev: any) => ({ memo: undefined })) as any);
      deps.updateListing(parentId, {
        memo: line,
        lastCommentText: comment.text,
        lastCommentAt: comment.createdAt,
        lastCommentAuthor: comment.authorName,
      });
    }
    deps.triggerDirty("listing", parentId);
  }
}

