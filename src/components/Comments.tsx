// src/components/Comments.tsx
// 매물/매수 상세에서 사용하는 간결한 댓글 UI

import React from "react";
import { SendHorizontal, Edit2, Trash2, CornerDownRight } from "lucide-react";
import { cx } from "../lib/cx";

import { useComments } from "../state/useComments";
import { useAuth } from "../context/AuthContext";
import type { Comment } from "../types/core";
import { useUserDirectory } from "../state/useUserDirectory";

type Props = {
  parentType: "listing" | "buyer";
  parentId: string;
  className?: string;
  maxVisibleRoots?: number;
};

type ThreadNode = {
  comment: Comment;
  replies: ThreadNode[];
};

const DEFAULT_VISIBLE_ROOTS = 4;

export default function Comments({
  parentType,
  parentId,
  className,
  maxVisibleRoots = DEFAULT_VISIBLE_ROOTS,
}: Props) {
  const { listByParent, add, update, remove, getNotesSyncMode } = useComments();
  const { user } = useAuth();
  const { getName } = useUserDirectory();
  const comments = listByParent(parentType, parentId);

  const [draft, setDraft] = React.useState("");
  const [sync, setSync] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingText, setEditingText] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);
  const [replyDrafts, setReplyDrafts] = React.useState<Record<string, string>>(
    {}
  );

  const formattedThreads = React.useMemo<ThreadNode[]>(() => {
    const map = new Map<string, ThreadNode>();
    const roots: ThreadNode[] = [];

    comments.forEach((comment) => {
      map.set(comment.id, { comment, replies: [] });
    });

    map.forEach((node) => {
      if (node.comment.replyToId && map.has(node.comment.replyToId)) {
        map.get(node.comment.replyToId)!.replies.push(node);
      } else {
        roots.push(node);
      }
    });

    // 하위 답글은 오래된 순으로, 루트 댓글은 최신 순으로 정렬
    const sortAsc = (nodes: ThreadNode[]) => {
      nodes.sort((a, b) => a.comment.createdAt - b.comment.createdAt);
      nodes.forEach((node) => sortAsc(node.replies));
    };
    sortAsc(roots);
    roots.sort((a, b) => b.comment.createdAt - a.comment.createdAt);

    return roots;
  }, [comments]);

  const visibleThreads = expanded
    ? formattedThreads
    : formattedThreads.slice(0, maxVisibleRoots);

  const totalCount = formattedThreads.length;
  const hasMore = totalCount > maxVisibleRoots;

  const resolveAuthor = React.useCallback(
    (comment: Comment) => {
      const storedName = comment.authorName?.trim();
      const storedEmail =
        (comment as any)?.authorEmail ||
        (storedName && storedName.includes("@") ? storedName : undefined);

      const fromDirectory =
        getName(comment.authorId, storedEmail ?? null)?.trim() || undefined;
      const cleanName =
        storedName && !storedName.includes("@") ? storedName : undefined;
      const cleanId =
        comment.authorId && !comment.authorId.includes("@")
          ? comment.authorId.trim()
          : undefined;

      const display =
        fromDirectory ||
        cleanName ||
        cleanId ||
        (storedEmail ? maskEmail(storedEmail) : undefined) ||
        "알 수 없음";

      return {
        display,
        email: storedEmail,
      };
    },
    [getName]
  );

  const formatTimestamp = React.useCallback((value: any) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    return `${yy}.${mm}.${dd}\n${hh}:${mi}`;
  }, []);

  const mainTextareaRef = useAutoResize(draft);
  const getReplyTextareaRef = useReplyAutoResize(replyDrafts);

  const handleSubmit = async () => {
    if (!user || !draft.trim() || busy) return;
    setBusy(true);
    try {
      await add({
        parentType,
        parentId,
        authorId: user.uid,
        authorName: (user as any).name || (user as any).email || user.uid,
        authorEmail: user.email ?? undefined,
        text: draft.trim(),
        syncToNotes: sync,
      });
      setDraft("");
      setSync(true);
      if (!expanded && totalCount + 1 > maxVisibleRoots) {
        setExpanded(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  const handleUpdate = async (id: string) => {
    const text = editingText.trim();
    if (!text) return;
    await update(id, { text });
    setEditingId(null);
    setEditingText("");
  };

  const handleReplySubmit = async (parentCommentId: string) => {
    if (!user) return;
    const text = replyDrafts[parentCommentId]?.trim();
    if (!text) return;
    await add({
      parentType,
      parentId,
      replyToId: parentCommentId,
      authorId: user.uid,
      authorName: (user as any).name || (user as any).email || user.uid,
      authorEmail: user.email ?? undefined,
      text,
      syncToNotes: false,
    });
    setReplyDrafts((prev) => {
      const next = { ...prev };
      delete next[parentCommentId];
      return next;
    });
  };

  const handleReplyKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    parentCommentId: string
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleReplySubmit(parentCommentId);
    }
  };

  const renderNode = (node: ThreadNode, depth = 0) => {
    const { comment } = node;
    const owner = user?.uid && comment.authorId === user.uid;
    const { display: author, email: authorEmail } = resolveAuthor(comment);
    const timestamp = formatTimestamp(comment.createdAt);
    const isEditing = editingId === comment.id;
    const replying = replyDrafts[comment.id] != null;
    const textClass =
      "text-sm text-neutral-800 leading-tight sm:line-clamp-2";

    const tooltipAuthor = authorEmail
      ? `${author} (${authorEmail})`
      : author;

    return (
      <li
        key={comment.id}
        className={cx("space-y-2", depth > 0 && "pl-5")}
        title={`${comment.text}\n${tooltipAuthor} · ${timestamp}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
                  value={editingText}
                  onChange={(event) => setEditingText(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => handleUpdate(comment.id)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setEditingText("");
                  }}
                  className="text-xs text-neutral-500 hover:underline"
                >
                  취소
                </button>
              </div>
            ) : (
              <p className={cx(textClass, "break-words")} title={comment.text}>
                {comment.text}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <button
                type="button"
                onClick={() =>
                  user &&
                  setReplyDrafts((prev) => ({
                    ...prev,
                    [comment.id]: prev[comment.id] ?? "",
                  }))
                }
                disabled={!user}
                className="inline-flex items-center gap-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-40"
              >
                <CornerDownRight className="h-3 w-3" />
                답글
              </button>
              {owner ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(comment.id);
                      setEditingText(comment.text);
                    }}
                    className="inline-flex items-center gap-1 text-neutral-400 hover:text-neutral-700"
                    title="수정"
                  >
                    <Edit2 className="h-3 w-3" />
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(comment.id)}
                    className="inline-flex items-center gap-1 text-neutral-400 hover:text-rose-600"
                    title="삭제"
                  >
                    <Trash2 className="h-3 w-3" />
                    삭제
                  </button>
                </>
              ) : null}
            </div>

            {replying ? (
              <div className="mt-2">
                <textarea
                  ref={getReplyTextareaRef(comment.id)}
                  value={replyDrafts[comment.id] ?? ""}
                  onChange={(event) =>
                    setReplyDrafts((prev) => ({
                      ...prev,
                      [comment.id]: event.target.value,
                    }))
                  }
                  onKeyDown={(event) => handleReplyKeyDown(event, comment.id)}
                  placeholder="답글을 입력하세요 (Enter: 등록, Shift+Enter: 줄바꿈)"
                  className="w-full resize-none rounded-md border border-neutral-300 px-2 py-1 text-sm"
                  rows={1}
                />
                <div className="mt-1 flex justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setReplyDrafts((prev) => {
                        const next = { ...prev };
                        delete next[comment.id];
                        return next;
                      })
                    }
                    className="text-neutral-400 hover:text-neutral-600"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReplySubmit(comment.id)}
                    className="text-blue-500 hover:text-blue-600 disabled:opacity-40"
                    disabled={!replyDrafts[comment.id]?.trim()}
                  >
                    등록
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="min-w-[82px] text-right text-xs text-neutral-400 leading-tight">
            <div
              className="font-medium text-neutral-600"
              title={authorEmail ?? undefined}
            >
              {author}
            </div>
            <div className="whitespace-pre-line">{timestamp}</div>
          </div>
        </div>

        {node.replies.length > 0 ? (
          <ul className="space-y-3 border-l border-neutral-200 pl-4">
            {node.replies.map((child) => renderNode(child, depth + 1))}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <section className={cx("space-y-3", className)}>
      <header className="flex items-center justify-between text-sm font-semibold text-neutral-700">
        <span>댓글</span>
        <span className="text-xs font-normal text-neutral-400">
          비고 동기화:{" "}
          {getNotesSyncMode() === "last" ? "최근 1건" : "모든 댓글"}
        </span>
      </header>

      <div className="rounded-md border border-neutral-200 bg-white p-3 shadow-sm">
        <ul className="max-h-60 space-y-3 overflow-y-auto pr-1 text-neutral-700">
          {visibleThreads.length === 0 ? (
            <li className="text-sm text-neutral-400">등록된 댓글이 없습니다.</li>
          ) : (
            visibleThreads.map((node) => renderNode(node))
          )}
        </ul>

        {hasMore ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="mt-3 text-xs text-neutral-400 hover:text-neutral-600"
          >
            {expanded ? "접기" : `더 보기 (${totalCount - maxVisibleRoots})`}
          </button>
        ) : null}
      </div>

      <div className="space-y-2">
        <textarea
          ref={mainTextareaRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 pr-10 text-sm"
          placeholder={
            user
              ? "댓글을 입력하세요 (Enter: 등록, Shift+Enter: 줄바꿈)"
              : "로그인이 필요합니다."
          }
          rows={1}
          disabled={!user}
        />
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={sync}
              onChange={(event) => setSync(event.target.checked)}
              disabled={!user}
            />
            비고에 반영
          </label>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!user || busy || !draft.trim()}
            className="inline-flex items-center gap-1 text-neutral-500 hover:text-neutral-800 disabled:opacity-40"
          >
            <SendHorizontal className="h-4 w-4" />
            등록
          </button>
        </div>
      </div>
    </section>
  );
}

function useAutoResize(content: string) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [content]);
  return ref;
}

function useReplyAutoResize(drafts: Record<string, string>) {
  const nodes = React.useRef<Record<string, HTMLTextAreaElement | null>>({});
  const callbacks = React.useRef<
    Record<string, (element: HTMLTextAreaElement | null) => void>
  >({});

  React.useEffect(() => {
    Object.keys(drafts).forEach((id) => {
      const el = nodes.current[id];
      if (el) {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }
    });
  }, [drafts]);

  return React.useCallback((id: string) => {
    if (!callbacks.current[id]) {
      callbacks.current[id] = (element: HTMLTextAreaElement | null) => {
        nodes.current[id] = element;
        if (element) {
          element.style.height = "auto";
          element.style.height = `${element.scrollHeight}px`;
        }
      };
    }
    return callbacks.current[id];
  }, []);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) {
    return email
      .split("")
      .map((char, index) => (index < 2 ? char : "*"))
      .join("");
  }
  const maskedDomain = domain.replace(/[^.]/g, "*");
  return `${local}@${maskedDomain}`;
}
