import React from "react";
import { useBuyers, updateBuyer } from "../state/useBuyers";
import { listUserProfiles, type UserProfile } from "../lib/users";
import { useComments as useFsComments } from "../lib/comments";
import { useAuth } from "../context/AuthContext";
import CommentThread from "./CommentThread";
import { useMatches } from "../state/useMatches";
import { useSelection } from "../context/SelectionContext";
import { rememberBuyerMatches } from "../state/useBuyerMatchMemory";
import { useNavigate } from "react-router-dom";
import { useListings } from "../state/useListings";

type Props = { open: boolean; buyerId: string; onClose: () => void };
type BuyerStatus = "active" | "hold" | "completed";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-50 rounded-xl px-3 py-2 ring-1 ring-neutral-200">
      <div className="text-[12px] text-neutral-500">{label}</div>
      <div className="font-medium">{children}</div>
    </div>
  );
}

const BUYER_STATUS_OPTIONS: Array<{ value: BuyerStatus; label: string }> = [
  { value: "active", label: "진행" },
  { value: "hold", label: "보류" },
  { value: "completed", label: "완료" },
];

function normalizeBuyerStatus(status?: string | null): BuyerStatus {
  const text = String(status ?? "").trim().toLowerCase();
  if (text === "hold") return "hold";
  if (text === "completed" || text === "archived") return "completed";
  return "active";
}

export default function BuyerDetailSheet({ open, buyerId, onClose }: Props) {
  const rows = useBuyers();
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [draft, setDraft] = React.useState<any | null>(null);
  const { user } = useAuth();
  const fsComments = useFsComments("buyer", open ? buyerId : null);
  const matches = useMatches();
  const { setMany } = useSelection("listings");
  const nav = useNavigate();
  const listings = useListings() as any[] | undefined;
  const complexOptions = React.useMemo(() => {
    const s = new Set<string>();
    (listings ?? []).forEach((l: any) => { if (l?.complex) s.add(String(l.complex)); });
    return Array.from(s).sort();
  }, [listings]);

  const [budgetMinStr, setBudgetMinStr] = React.useState("");
  const [budgetMaxStr, setBudgetMaxStr] = React.useState("");

  React.useEffect(() => {
    listUserProfiles()
      .then((all) => setUsers(all.filter((u) => u.role === "owner" || u.role === "admin" || u.role === "staff")))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!open || !buyerId) { setDraft(null); return; }
    const r = (rows as any[]).find((b) => b.id === buyerId) as any;
    setDraft(r ? { ...r } : null);
  }, [open, buyerId, rows]);

  React.useEffect(() => {
    const min = (draft as any)?.budgetMin;
    const max = (draft as any)?.budgetMax;
    setBudgetMinStr(min != null ? String(min) : "");
    setBudgetMaxStr(max != null ? String(max) : "");
  }, [draft?.budgetMin, draft?.budgetMax]);

  React.useEffect(() => {
    if (!open || !buyerId) return;
    const current = (rows as any[]).find((b) => b.id === buyerId) as any;
    if (!fsComments || fsComments.length === 0) {
      if (current?.lastCommentText || current?.lastCommentAt || current?.lastCommentAuthor) {
        updateBuyer(buyerId, { lastCommentText: "", lastCommentAt: undefined as any, lastCommentAuthor: undefined as any } as any);
      }
      return;
    }
    const last = fsComments[fsComments.length - 1] as any;
    const text = String(last.text || "").trim();
    const createdMs = last?.createdAt?.toMillis?.() ?? last?.createdAt ?? undefined;
    const author = last?.createdByName ?? last?.createdByEmail ?? last?.createdByUid ?? undefined;
    if (!text) {
      if (current?.lastCommentText) updateBuyer(buyerId, { lastCommentText: "", lastCommentAt: undefined as any, lastCommentAuthor: undefined as any } as any);
      return;
    }
    if (current?.lastCommentText !== text || current?.lastCommentAt !== createdMs) {
      updateBuyer(buyerId, { lastCommentText: text, lastCommentAt: createdMs as any, lastCommentAuthor: author } as any);
    }
  }, [open, buyerId, fsComments]);

  const canEdit = React.useMemo(() => {
    const email = String((user as any)?.email || "").toLowerCase();
    const uid = String((user as any)?.uid || "");
    if (!user) return false;
    const role = (user as any)?.role;
    const isAdmin = role === "owner" || role === "admin";
    const createdEmail = String((draft as any)?.createdByEmail || "").toLowerCase();
    const createdUid = String((draft as any)?.createdByUid || "");
    const isOwner = (!!email && email === createdEmail) || (!!uid && uid === createdUid);
    return isAdmin || isOwner;
  }, [user, (draft as any)?.createdByEmail, (draft as any)?.createdByUid]);

  const canSeePhone = React.useMemo(() => {
    if (!draft) return false;
    const email = String((user as any)?.email || "").toLowerCase();
    const uid = String((user as any)?.uid || "");
    const role = (user as any)?.role;
    const isAdmin = role === "owner" || role === "admin";
    const createdEmail = String((draft as any)?.createdByEmail || "").toLowerCase();
    const createdUid = String((draft as any)?.createdByUid || "");
    const assignedTo = String((draft as any)?.assignedTo || "");
    const isAssignee = !!assignedTo && (assignedTo === (user as any)?.name || assignedTo === (user as any)?.email || assignedTo === uid);
    return isAdmin || isAssignee || (!!email && email === createdEmail) || (!!uid && uid === createdUid);
  }, [draft, user]);

  if (!open) return null;
  const editDisabled = !canEdit;
  const loading = !buyerId || !draft;
  const viewOnly = editDisabled;

  const invalidBudget = React.useMemo(() => {
    const min = budgetMinStr ? Number(budgetMinStr) : undefined;
    const max = budgetMaxStr ? Number(budgetMaxStr) : undefined;
    if (min == null || max == null) return false;
    return min > max;
  }, [budgetMinStr, budgetMaxStr]);

  const invalidArea = React.useMemo(() => {
    const minA = typeof (draft as any)?.areaMinPy === "number" ? (draft as any).areaMinPy : undefined;
    const maxA = typeof (draft as any)?.areaMaxPy === "number" ? (draft as any).areaMaxPy : undefined;
    if (minA == null || maxA == null) return false;
    return minA > maxA;
  }, [draft?.areaMinPy, draft?.areaMaxPy]);

  const currentStatus = normalizeBuyerStatus(draft?.status);
  const statusDisabled = editDisabled || loading;

  async function handleStatusChange(nextStatus: BuyerStatus) {
    if (statusDisabled || !buyerId) return;
    if (currentStatus === nextStatus) return;
    setDraft((prev: any) => ({ ...(prev ?? {}), status: nextStatus }));
    try {
      await updateBuyer(buyerId, { status: nextStatus });
    } catch (error) {
      console.error(error);
    }
  }

  async function handleSave() {
    if (!draft) return;
    const p: any = {
      name: draft.name ?? undefined,
      ownerName: draft.ownerName ?? undefined,
      phone: draft.phone ?? undefined,
      budgetMin: draft.budgetMin ?? undefined,
      budgetMax: draft.budgetMax ?? undefined,
      budgetText: draft.budgetText ?? undefined,
      typePrefs: (draft.typePrefs ?? []).filter(Boolean),
      areaMinPy: typeof draft.areaMinPy === "number" ? draft.areaMinPy : undefined,
      areaMaxPy: typeof draft.areaMaxPy === "number" ? draft.areaMaxPy : undefined,
      areaPrefsPy: (draft.areaPrefsPy ?? []).filter((x: any) => x !== "").map((x: any) => (typeof x === "number" ? x : Number(x))).filter((n: any) => Number.isFinite(n)),
      complexPrefs: (draft.complexPrefs ?? []).filter(Boolean),
      floors: (draft.floors ?? []).filter(Boolean),
      mustHaves: (draft.mustHaves ?? []).filter(Boolean),
      notes: draft.notes ?? undefined,
      assignedTo: draft.assignedTo ?? undefined,
      receivedDate: draft.receivedDate ?? undefined,
      status: draft.status ?? undefined,
    };
    await updateBuyer(buyerId, p);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-4xl rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-neutral-500">매수자</div>
              <h3 className="text-lg font-bold mt-1">{draft?.name || "-"}</h3>
            </div>
            <div className="text-right min-w-0">
              <div className="text-sm text-neutral-900 truncate">
                {canSeePhone && draft?.phone ? (
                  <a href={`tel:${String(draft?.phone).replace(/[^0-9+]/g, "")}`} className="hover:underline text-neutral-900">
                    {String(draft?.phone)}
                  </a>
                ) : (
                  <span className="text-neutral-400">비공개</span>
                )}
              </div>
            </div>
          </div>

          {/* 메모 + 댓글 (상단) */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-neutral-700 mb-1">메모</label>
              {viewOnly ? (
                <div className="min-h-[60px] px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 whitespace-pre-wrap">
                  {draft?.notes ? draft.notes : <span className="text-neutral-400">메모 없음</span>}
                </div>
              ) : (
                <textarea
                  className="w-full min-h-[100px] px-3 py-2 rounded-lg border border-neutral-300"
                  value={draft?.notes ?? ""}
                  onChange={(e) => setDraft((prev: any) => ({ ...(prev ?? {}), notes: e.target.value }))}
                  disabled={loading}
                  placeholder="추가 정보를 입력하세요."
                />
              )}
            </div>
            <div>
              <CommentThread entityType="buyer" entityId={buyerId} />
            </div>
          </div>

          {/* 기본 정보 */}
          <div className="space-y-4">
            {viewOnly ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="제목">{draft?.name || '-'}</Field>
                  <Field label="소유자명">{draft?.ownerName || '-'}</Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="연락처">{canSeePhone ? (draft?.phone || '-') : <span className="text-neutral-400">비공개</span>}</Field>
                  <Field label="접수일자">{draft?.receivedDate || '-'}</Field>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-neutral-700 mb-1">제목</label>
                    <input
                      className="w-full h-9 px-3 rounded-lg border border-neutral-300 disabled:bg-neutral-50"
                      value={draft?.name ?? ""}
                      onChange={(e) => setDraft((prev: any) => ({ ...(prev ?? {}), name: e.target.value }))}
                      disabled={editDisabled || loading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-700 mb-1">소유자명</label>
                    <input
                      className="w-full h-9 px-3 rounded-lg border border-neutral-300 disabled:bg-neutral-50"
                      value={draft?.ownerName ?? ""}
                      onChange={(e) => setDraft((prev: any) => ({ ...(prev ?? {}), ownerName: e.target.value }))}
                      disabled={editDisabled || loading}
                      placeholder="소유자 이름"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-neutral-700 mb-1">연락처</label>
                    {canSeePhone ? (
                      <input
                        className="w-full h-9 px-3 rounded-lg border border-neutral-300 disabled:bg-neutral-50"
                        value={draft?.phone ?? ""}
                        onChange={(e) => setDraft((prev: any) => ({ ...(prev ?? {}), phone: e.target.value }))}
                        disabled={editDisabled || loading}
                        placeholder="010-0000-0000"
                      />
                    ) : (
                      <div className="h-9 flex items-center text-neutral-400">비공개</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-700 mb-1">접수일자</label>
                    <input
                      type="date"
                      className="w-full h-9 px-3 rounded-lg border border-neutral-300 disabled:bg-neutral-50"
                      value={draft?.receivedDate ?? ""}
                      onChange={(e) => setDraft((prev: any) => ({ ...(prev ?? {}), receivedDate: e.target.value }))}
                      disabled={editDisabled || loading}
                    />
                  </div>
                </div>
              </>
            )}

            {viewOnly ? (
              <Field label="거래 유형">{(draft?.typePrefs ?? []).join(', ') || '없음'}</Field>
            ) : (
              <div>
                <div className="text-sm font-semibold text-neutral-700 mb-1">거래 유형</div>
                <div className="flex flex-wrap gap-3">
                  {(["매매", "전세", "월세"] as const).map((t) => (
                    <label key={t} className="inline-flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={(draft?.typePrefs ?? []).includes(t)}
                        onChange={(e) => {
                          const set = new Set<string>(draft?.typePrefs ?? []);
                          if (e.target.checked) set.add(t); else set.delete(t);
                          setDraft((prev: any) => ({ ...(prev ?? {}), typePrefs: Array.from(set) }));
                        }}
                        disabled={editDisabled || loading}
                      />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {viewOnly ? (
              <Field label="담당자">{draft?.assignedTo || '미지정'}</Field>
            ) : (
              <div>
                <label className="block text-sm text-neutral-700 mb-1">담당자</label>
                <select
                  value={draft?.assignedTo ?? ""}
                  onChange={(e) => setDraft((prev: any) => ({ ...(prev ?? {}), assignedTo: e.target.value || undefined }))}
                  className="w-full h-9 px-3 rounded-lg border border-neutral-300 disabled:bg-neutral-50"
                  disabled={editDisabled || loading}
                >
                  <option value="">미지정</option>
                  {users.map((u) => (
                    <option key={u.uid} value={u.name || u.email || u.uid}>
                      {u.name || u.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-500">상태</span>
            <div className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white p-1">
              {BUYER_STATUS_OPTIONS.map((option) => {
                const active = currentStatus === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleStatusChange(option.value)}
                    disabled={statusDisabled}
                    className={`px-3 py-1 rounded-full text-xs transition ${
                      active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900"
                    } ${statusDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 상단 액션: 저장/닫기/매칭 */}
          <div className="flex gap-2">
            {canEdit ? (<button onClick={handleSave} disabled={loading} className="h-9 px-3 rounded-lg ring-1 ring-neutral-300 text-sm disabled:opacity-50">저장</button>) : null}
            <button onClick={onClose} className="h-9 px-3 rounded-lg ring-1 ring-neutral-300 text-sm">닫기</button>
            {(() => {
              const top = matches.getForBuyer(buyerId, 10);
              const count = top.length;
              return (
                <button
                  type="button"
                  disabled={count === 0}
                  onClick={() => {
                    if (!count) return;
                    const ids = top.map((m: any) => m.id);
                    try { setMany(ids); } catch {}
                    rememberBuyerMatches(buyerId, ids);
                    nav(`/selected?fromBuyer=${encodeURIComponent(String(buyerId))}`, { state: { matchedIds: ids, fromBuyerId: buyerId } } as any);
                  }}
                  className={`h-9 px-3 rounded-full text-[12px] ${count > 0 ? "text-emerald-800 bg-emerald-100 hover:bg-emerald-200" : "text-neutral-400 bg-neutral-100 cursor-not-allowed"}`}
                  title="매칭된 매물 선택"
                  aria-label={`매칭 ${count}`}
                >
                  매칭 <span className="font-semibold">{count}</span>
                </button>
              );
            })()}
          </div>

          {/* 8: 희망 단지 및 기타 단지추가 */}
          <div className="mt-4">
            <label className="block text-sm text-neutral-700 mb-1">희망 단지</label>
            {Array.isArray(complexOptions) && complexOptions.length > 0 ? (
              <div className="max-h-36 overflow-auto rounded-lg ring-1 ring-neutral-200 p-2 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {complexOptions.map((c) => {
                    const checked = (draft?.complexPrefs ?? []).includes(c);
                    return (
                      <label key={c} className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={editDisabled || loading}
                          onChange={(e) => {
                            const set = new Set<string>(draft?.complexPrefs ?? []);
                            if (e.target.checked) set.add(c); else set.delete(c);
                            setDraft((prev: any) => ({ ...(prev ?? {}), complexPrefs: Array.from(set) }));
                          }}
                        />
                        <span className="truncate" title={c}>{c}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-[12px] text-neutral-500">등록된 단지 목록이 없습니다.</div>
            )}
            <OtherComplexInputInline
              disabled={editDisabled || loading}
              selected={(draft?.complexPrefs ?? []) as string[]}
              onAdd={(names) => {
                const set = new Set<string>(draft?.complexPrefs ?? []);
                names.forEach((n) => set.add(n));
                setDraft((prev: any) => ({ ...(prev ?? {}), complexPrefs: Array.from(set) }));
              }}
            />
          </div>

          {/* 9: 예산(한 줄) + 평(범위) */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-neutral-700 mb-1">예산(만원)</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="w-full h-9 px-3 rounded-lg border border-neutral-300 disabled:bg-neutral-50"
                  value={budgetMinStr}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "");
                    setBudgetMinStr(v);
                    const num = v ? Number(v) : undefined;
                    setDraft((prev: any) => ({ ...(prev ?? {}), budgetMin: num }));
                  }}
                  inputMode="numeric"
                  placeholder="min"
                  disabled={editDisabled || loading}
                />
                <input
                  className="w-full h-9 px-3 rounded-lg border border-neutral-300 disabled:bg-neutral-50"
                  value={budgetMaxStr}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "");
                    setBudgetMaxStr(v);
                    const num = v ? Number(v) : undefined;
                    setDraft((prev: any) => ({ ...(prev ?? {}), budgetMax: num }));
                  }}
                  inputMode="numeric"
                  placeholder="max"
                  disabled={editDisabled || loading}
                />
              </div>
              {invalidBudget ? (
                <div className="text-[12px] text-red-600 mt-1">미달의 값은 최대값보다 작을 수 없습니다.</div>
              ) : null}
            </div>
            <div>
              <label className="block text-sm text-neutral-700 mb-1">희망 면적 범위(평)</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="w-full h-9 px-3 rounded-lg border border-neutral-300 disabled:bg-neutral-50"
                  value={draft?.areaMinPy ?? ""}
                  onChange={(e) => setDraft((prev: any) => ({ ...(prev ?? {}), areaMinPy: e.target.value ? Number(e.target.value.replace(/[^0-9]/g, "")) : undefined }))}
                  inputMode="numeric"
                  placeholder="min"
                  disabled={editDisabled || loading}
                />
                <input
                  className="w-full h-9 px-3 rounded-lg border border-neutral-300 disabled:bg-neutral-50"
                  value={draft?.areaMaxPy ?? ""}
                  onChange={(e) => setDraft((prev: any) => ({ ...(prev ?? {}), areaMaxPy: e.target.value ? Number(e.target.value.replace(/[^0-9]/g, "")) : undefined }))}
                  inputMode="numeric"
                  placeholder="max"
                  disabled={editDisabled || loading}
                />
              </div>
              {invalidArea ? (
                <div className="text-[12px] text-red-600 mt-1">면적 최소값은 최대값보다 작아야 합니다.</div>
              ) : null}
            </div>
          </div>

          {/* 10: 저장/닫기/매칭 토글 (하단) */}
          <div className="mt-3 flex gap-2">
            {canEdit ? (<button onClick={handleSave} disabled={loading} className="h-9 px-3 rounded-lg ring-1 ring-neutral-300 text-sm disabled:opacity-50">저장</button>) : null}
            <button onClick={onClose} className="h-9 px-3 rounded-lg ring-1 ring-neutral-300 text-sm">닫기</button>
            {(() => {
              const top = matches.getForBuyer(buyerId, 10);
              const count = top.length;
              return (
                <button
                  type="button"
                  disabled={count === 0}
                  onClick={() => {
                    if (!count) return;
                    const ids = top.map((m: any) => m.id);
                    try { setMany(ids); } catch {}
                    rememberBuyerMatches(buyerId, ids);
                    nav(`/selected?fromBuyer=${encodeURIComponent(String(buyerId))}`, { state: { matchedIds: ids, fromBuyerId: buyerId } } as any);
                  }}
                  className={`h-9 px-3 rounded-full text-[12px] ${count > 0 ? "text-emerald-800 bg-emerald-100 hover:bg-emerald-200" : "text-neutral-400 bg-neutral-100 cursor-not-allowed"}`}
                  title="매칭된 매물 선택"
                  aria-label={`매칭 ${count}`}
                >
                  매칭 <span className="font-semibold">{count}</span>
                </button>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

function OtherComplexInputInline({ disabled, selected, onAdd }: { disabled: boolean; selected: string[]; onAdd: (names: string[]) => void }) {
  const [text, setText] = React.useState("");
  function commit() {
    const parts = text
      .split(/\s*,\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !selected.includes(s));
    if (parts.length > 0) onAdd(parts);
    setText("");
  }
  return (
    <div className="mt-2">
      <label className="block text-[12px] text-neutral-500 mb-1">기타 단지 추가(, 구분)</label>
      <div className="flex gap-2">
        <input
          className="flex-1 h-9 px-3 rounded-lg border border-neutral-300"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if ((e as any).key === 'Enter') { (e as any).preventDefault(); commit(); } }}
          placeholder="단지A, 단지B"
          disabled={disabled}
        />
        <button type="button" onClick={commit} disabled={disabled || !text.trim()} className="h-9 px-3 rounded-lg bg-white ring-1 ring-neutral-300 text-sm disabled:opacity-50">추가</button>
      </div>
      {selected.length > 0 ? (
        <div className="mt-1 text-[12px] text-neutral-600">선택: {selected.join(', ')}</div>
      ) : null}
    </div>
  );
}
