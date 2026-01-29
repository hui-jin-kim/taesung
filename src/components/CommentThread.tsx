// src/components/CommentThread.tsx
// Firestore 기반 댓글 스레드 UI (관리자/기타 페이지용)

import React from "react";
import { SendHorizontal, Edit2, Trash2, CornerDownRight } from "lucide-react";
import { cx } from "../lib/cx";

import { useAuth } from "../context/AuthContext";
import {
  CommentEntityType,
  CommentDoc,
  createComment,
  deleteComment,
  updateComment,
  useComments as useRemoteComments,
} from "../lib/comments";
import { useUserDirectory } from "../state/useUserDirectory";

type Props = {
  entityType: CommentEntityType;
  entityId: string | null;
  className?: string;
  maxVisibleRoots?: number;
};

type ThreadNode = {
  comment: CommentDoc;
  replies: ThreadNode[];
};

const DEFAULT_VISIBLE_ROOTS = 4;

export default function CommentThread({
  entityType,
  entityId,
  className,
  maxVisibleRoots = DEFAULT_VISIBLE_ROOTS,
}: Props) {
  const { user } = useAuth();
  const comments = useRemoteComments(entityType, entityId);
  const { getName } = useUserDirectory();

  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingText, setEditingText] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);
  const [replyDrafts, setReplyDrafts] = React.useState<Record<string, string>>(
    {}
  );

  const threads = React.useMemo<ThreadNode[]>(() => {
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

    const sortAsc = (nodes: ThreadNode[]) => {
      nodes.sort(
        (a, b) => getMillis(a.comment.createdAt) - getMillis(b.comment.createdAt)
      );
      nodes.forEach((node) => sortAsc(node.replies));
    };
    sortAsc(roots);
    roots.sort((a, b) => getMillis(b.comment.createdAt) - getMillis(a.comment.createdAt));

    return roots;
  }, [comments]);

  const visibleThreads = expanded
    ? threads
    : threads.slice(0, maxVisibleRoots);

  const totalCount = threads.length;
  const hasMore = totalCount > maxVisibleRoots;

  const mainTextareaRef = useAutoResize(draft);
  const getReplyTextareaRef = useReplyAutoResize(replyDrafts);

  const resolveAuthor = React.useCallback(
    (comment: CommentDoc) => {
      const storedName = comment.createdByName?.trim();
      const storedEmail =
        comment.createdByEmail?.trim() ||
        (storedName && storedName.includes("@") ? storedName : undefined);

      const fromDirectory =
        getName(comment.createdByUid, storedEmail ?? null)?.trim() || undefined;
      const cleanName =
        storedName && !storedName.includes("@") ? storedName : undefined;
      const cleanUid =
        comment.createdByUid && !comment.createdByUid.includes("@")
          ? comment.createdByUid.trim()
          : undefined;

      const display =
        fromDirectory ||
        cleanName ||
        cleanUid ||
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
    const date = toDate(value);
    if (!date) return "-";
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    return `${yy}.${mm}.${dd}\n${hh}:${mi}`;
  }, []);

  const handleSubmit = async () => {
    if (!entityId || !user || !draft.trim() || busy) return;
    setBusy(true);
    try {
      await createComment(entityType, entityId, draft.trim());
      setDraft("");
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

  const handleReplySubmit = async (parentCommentId: string) => {
    if (!entityId || !user) return;
    const text = replyDrafts[parentCommentId]?.trim();
    if (!text) return;
    await createComment(entityType, entityId, text, {
      replyToId: parentCommentId,
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

  const handleUpdate = async (id: string) => {
    const text = editingText.trim();
    if (!text) return;
    await updateComment(id, text);
    setEditingId(null);
    setEditingText("");
  };

  const isOwner = React.useCallback(
    (comment: CommentDoc) => {
      if (!user?.uid) return false;
      return comment.createdByUid === user.uid;
    },
    [user?.uid]
  );

  const renderNode = (node: ThreadNode, depth = 0): React.ReactNode => {
    const { comment } = node;
    const owner = isOwner(comment);
    const isEditing = editingId === comment.id;
    const replying = replyDrafts[comment.id] != null;
    const { display: author, email: authorEmail } = resolveAuthor(comment);
    const timestamp = formatTimestamp(comment.createdAt);
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
                    onClick={() => void deleteComment(comment.id)}
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

  if (!entityId) {
    return (
      <section
        className={cx("space-y-2 text-sm text-neutral-500", className)}
      >
        항목을 선택하면 댓글을 확인할 수 있습니다.
      </section>
    );
  }

  return (
    <section className={cx("space-y-3", className)}>
      <header className="flex items-center justify-between text-sm font-semibold text-neutral-700">
        <span>댓글</span>
        <span className="text-xs font-normal text-neutral-400">
          총 {comments.length}건
        </span>
      </header>

      <div className="rounded-md border border-neutral-200 bg-white p-3 shadow-sm">
        <ul className="max-h-60 space-y-3 overflow-y-auto pr-1 text-neutral-700">
          {visibleThreads.length === 0 ? (
            <li className="text-sm text-neutral-400">
              등록된 댓글이 없습니다.
            </li>
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

      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
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
        <button
          type="submit"
          disabled={!user || busy || !draft.trim()}
          className="absolute bottom-2 right-2 text-neutral-500 hover:text-neutral-800 disabled:opacity-40"
          title="등록"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) return new Date(numeric);
  return null;
}

function getMillis(value: any): number {
  const date = toDate(value);
  return date ? date.getTime() : 0;
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
