import React from "react";
import { X } from "lucide-react";
import { createListing, type ListingDoc } from "../lib/listings";
import { useListings, useListingsVersion, updateListing, restoreListing } from "../state/useListings";
import { listUserProfiles, type UserProfile } from "../lib/users";
import { formatKRW, formatTimestamp } from "../lib/format";
import CommentThread from "./CommentThread";
import { useComments as useFsComments, createComment } from "../lib/comments";
import { useAuth } from "../context/AuthContext";
import { useUserDirectory } from "../state/useUserDirectory";
import type { Listing } from "../types/core";
import { getAllComplexes } from "../lib/complexIndex";

const STATUS_OPTIONS: Array<{ value: Listing["status"]; label: string }> = [
  { value: "active", label: "진행중" },
  { value: "pending", label: "대기" },
  { value: "completed", label: "완료" },
  { value: "ourDeal", label: "우리거래" },
];

type Actions = { save?: boolean; complete?: boolean; reopen?: boolean };

type Props = {
  open: boolean;
  listingId: string;
  onClose: () => void;
  actions?: Actions;
  onComplete?: (row: ListingDoc) => Promise<void>;
  onReopen?: (row: ListingDoc) => Promise<void>;
  prefill?: Partial<Listing>;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-50 rounded-xl px-3 py-2 ring-1 ring-neutral-200">
      <div className="text-[12px] text-neutral-500">{label}</div>
      <div className="font-medium [&>*]:text-sm [&>input]:h-11 [&>input]:px-3 [&>input]:py-2 [&>input]:border [&>input]:rounded [&>input]:border-neutral-200 [&>select]:h-11 [&>select]:px-3 [&>select]:py-2 [&>select]:border [&>select]:rounded [&>select]:border-neutral-200 [&>textarea]:px-3 [&>textarea]:py-2 [&>textarea]:min-h-[96px]">
        {children}
      </div>
    </div>
  );
}

function DongHo({ d, h }: { d?: string; h?: string }) {
  if (d && h) return <>{d}-{h}</>;
  return <>{d ?? h ?? ""}</>;
}

const numberFromInput = (value: string) => {
  if (!value) return undefined;
  // 숫자, 소수점 외 문자는 제거해서 입력 실수를 줄인다.
  const cleaned = value.replace(/[^\d.-]/g, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
};
const numberToInput = (value?: number | null) => {
  if (value === null || value === undefined) return "";
  return Number.isFinite(value) ? value.toFixed(2) : "";
};

const formatPriceText = (row: Partial<Listing>) => {
  if (row.price != null) return formatKRW(row.price);
  if (row.deposit != null || row.monthly != null) {
    const deposit = row.deposit != null ? formatKRW(row.deposit) : "";
    const monthly = row.monthly != null ? formatKRW(row.monthly) : "";
    return `${deposit}${monthly ? `/${monthly}` : ""}` || "-";
  }
  return "-";
};

type DraftState = Partial<ListingDoc> & { __isNew?: boolean };

export default function ListingDetailSheet({
  open,
  listingId,
  onClose,
  actions,
  onComplete,
  onReopen,
  prefill,
}: Props) {
  const rows = useListings();
  const listingsVersion = useListingsVersion();
  const complexOptions = React.useMemo(
    () => getAllComplexes().sort((a, b) => a.name.localeCompare(b.name, "ko")),
    []
  );
  const complexListId = React.useId();
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [draft, setDraft] = React.useState<DraftState | null>(null);
  const [supplyAreaInput, setSupplyAreaInput] = React.useState("");
  const [exclusiveAreaInput, setExclusiveAreaInput] = React.useState("");
  const [initialComment, setInitialComment] = React.useState("");
  const [isEditing, setIsEditing] = React.useState(false);
  const fsComments = useFsComments("listing", open && listingId !== "new" ? listingId : null);
  const { user } = useAuth();
  const { getName } = useUserDirectory();
  const rowsRef = React.useRef(rows);

  React.useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  React.useEffect(() => {
    listUserProfiles()
      .then((all) => setUsers(all.filter((u) => u.role === "owner" || u.role === "admin" || u.role === "staff")))
      .catch(() => {});
  }, []);

  const listing = React.useMemo(() => {
    if (!listingId || listingId === "new") return null;
    return rows.find((x) => x.id === listingId) ?? null;
  }, [rows, listingId]);

  React.useEffect(() => {
    if (!open || !listingId) {
      setDraft((prev) => (prev ? null : prev));
      setIsEditing(false);
      return;
    }
    if (listingId === "new") {
      const directoryName = getName(user?.uid ?? "", user?.email ?? "") ?? "";
      const userDisplayName =
        (prefill as any)?.assigneeName ??
        (directoryName ||
          (user as any)?.displayName ||
          (user as any)?.name ||
          user?.email ||
          "");
      setDraft({
        title: "",
        complex: "",
        dong: "",
        ho: "",
        type: (prefill?.type as Listing["type"]) ?? ("매매" as Listing["type"]),
        ownershipType: "our" as Listing["ownershipType"],
        status: "active" as Listing["status"],
        isActive: true,
        receivedAt: new Date().toISOString().slice(0, 10),
        phone: (prefill as any)?.phone ?? "",
        owner: (prefill as any)?.owner ?? "",
        memo: (prefill as any)?.memo ?? "",
        price: prefill?.price ?? undefined,
        deposit: prefill?.deposit ?? undefined,
        monthly: prefill?.monthly ?? undefined,
        assigneeUid: user?.uid ?? "",
        assigneeName: userDisplayName,
        typeSuffix: (prefill as any)?.typeSuffix ?? "",
        __isNew: true,
      } as DraftState);
      setInitialComment("");
      setIsEditing(false);
      return;
    }
    const current = rowsRef.current.find((x) => x.id === listingId) ?? null;
    if (!current) {
      setDraft((prev) => (prev ? null : prev));
      setIsEditing(false);
      return;
    }
    if (isEditing) return;
    setDraft((prev) => {
      const prevId = (prev as any)?.id;
      const prevUpdated =
        (prev as any)?.updatedAt?.toMillis?.() ?? (prev as any)?.updatedAt ?? undefined;
      const nextUpdated =
        (current as any)?.updatedAt?.toMillis?.() ?? (current as any)?.updatedAt ?? undefined;
      if (!prev || prevId !== current.id || prevUpdated !== nextUpdated) {
        return { ...(current as any) };
      }
      return prev;
    });
    setIsEditing(false);
  }, [
    open,
    listingId,
    prefill?.type,
    (prefill as any)?.phone,
    (prefill as any)?.memo,
    (prefill as any)?.owner,
    prefill?.price,
    prefill?.deposit,
    prefill?.monthly,
    user,
    getName,
  ]);

  React.useEffect(() => {
    if (!open || !listingId || listingId === "new") return;
    const current = rows.find((x) => x.id === listingId) as any;
    if (!fsComments || fsComments.length === 0) {
      if (current?.lastCommentText || current?.lastCommentAt || current?.lastCommentAuthor) {
        updateListing(listingId, {
          lastCommentText: "",
          lastCommentAt: undefined,
          lastCommentAuthor: undefined,
        });
      }
      return;
    }
    const last: any = fsComments[fsComments.length - 1];
    const text = String(last?.text || "").trim();
    const createdMs = last?.createdAt?.toMillis?.() ?? last?.createdAt ?? undefined;
    const author =
      last?.createdByName ?? last?.createdByEmail ?? last?.createdByUid ?? undefined;
    if (!text) return;
    if (current?.lastCommentText !== text || current?.lastCommentAt !== createdMs) {
      updateListing(listingId, {
        lastCommentText: text,
        lastCommentAt: createdMs,
        lastCommentAuthor: author,
      });
    }
  }, [open, listingId, fsComments, rows]);

  React.useEffect(() => {
    if (!open || !draft) return;
    const shouldSyncSupply =
      (supplyAreaInput ?? "") === "" && draft.supplyAreaM2 !== undefined && draft.supplyAreaM2 !== null;
    const shouldSyncExclusive =
      (exclusiveAreaInput ?? "") === "" &&
      draft.exclusiveAreaM2 !== undefined &&
      draft.exclusiveAreaM2 !== null;
    if (shouldSyncSupply) setSupplyAreaInput(numberToInput(draft.supplyAreaM2));
    if (shouldSyncExclusive) setExclusiveAreaInput(numberToInput(draft.exclusiveAreaM2));
  }, [open, draft?.id, draft?.supplyAreaM2, draft?.exclusiveAreaM2]);

  const canEditMemo = React.useMemo(() => {
    if (!user) return false;
    const role = (user as any).role;
    const email = String(user.email || "").toLowerCase();
    if (role === "owner" || role === "admin" || role === "staff") return true;
    const assignee = draft?.assigneeUid;
    if (assignee && user.uid && assignee === user.uid) return true;
    return false;
  }, [user, draft?.assigneeUid]);

  const overlayMouseDownRef = React.useRef(false);

  if (!open || !listingId || !draft) return null;

  async function handleSave() {
    if (!draft) return;
    const originalStatus = (listing as any)?.status as string | undefined;
    // 입력 버퍼에 있는 소수점 값을 우선하여 patch에 반영
    const supplyParsed = numberFromInput(supplyAreaInput);
    const exclusiveParsed = numberFromInput(exclusiveAreaInput);
    const supplyValue =
      supplyParsed !== undefined
        ? Number(supplyParsed.toFixed(2))
        : draft.supplyAreaM2 !== undefined
          ? Number(draft.supplyAreaM2.toFixed(2))
          : undefined;
    const exclusiveValue =
      exclusiveParsed !== undefined
        ? Number(exclusiveParsed.toFixed(2))
        : draft.exclusiveAreaM2 !== undefined
          ? Number(draft.exclusiveAreaM2.toFixed(2))
          : undefined;
  const current = { ...draft, supplyAreaM2: supplyValue, exclusiveAreaM2: exclusiveValue };
  const patch: Partial<Listing> = {
    title: typeof current.title === "string" ? current.title : (current as any).title ?? "",
    complex: current.complex ?? undefined,
    dong: current.dong ?? undefined,
    ho: current.ho ?? undefined,
    area_py: current.area_py ?? undefined,
    mobileMemo: (current as any)?.mobileMemo ?? undefined,
    type: current.type ?? undefined,
    typeSuffix: (current as any)?.typeSuffix ?? undefined,
    supplyAreaM2: supplyValue,
    exclusiveAreaM2: exclusiveValue,
    moveInDate: current.moveInDate ?? undefined,
      rooms: current.rooms ?? undefined,
      bathrooms: current.bathrooms ?? undefined,
      maintenanceFee: current.maintenanceFee ?? undefined,
      totalFloors: current.totalFloors ?? undefined,
      direction: current.direction ?? undefined,
      price: current.price ?? undefined,
      deposit: current.deposit ?? undefined,
      monthly: current.monthly ?? undefined,
      receivedAt: (current as any).receivedAt ?? undefined,
      expiryAt: (current as any).expiryAt ?? undefined,
      closedAt: current.closedAt ?? undefined,
      closedByUs: current.closedByUs ?? undefined,
      memo: current.memo ?? undefined,
      owner: (current as any).owner ?? undefined,
      agency: current.agency ?? undefined,
      phone: current.phone ?? undefined,
      assigneeUid: current.assigneeUid ?? undefined,
      assigneeName: current.assigneeName ?? undefined,
      ownershipType: (current as any).ownershipType ?? "our",
      urgent: (current as any).urgent ?? false,
    };
    // 저장만으로는 완료 상태로 전환되지 않도록 보호 (완료/종료는 별도 버튼 사용)
    const statusText = String(patch.status || "").toLowerCase();
    if (statusText.includes("complete") || ["완료", "종료", "계약"].some((w) => String(patch.status || "").includes(w))) {
      patch.status = (originalStatus as any) ?? "active";
    }
    const manualMeta: Partial<Listing> = {
      lastSavedAt: Date.now(),
    };
    const savedByName =
      getName(user?.uid ?? "", user?.email ?? "") ??
      (user as any)?.displayName ??
      user?.email ??
      user?.uid ??
      undefined;
    if (savedByName) {
      manualMeta.lastSavedByName = savedByName;
      manualMeta.lastSavedBy = savedByName;
    }
    if (user?.email) {
      manualMeta.lastSavedByEmail = user.email;
      if (!manualMeta.lastSavedBy) manualMeta.lastSavedBy = user.email;
    }
    if (user?.uid) {
      manualMeta.lastSavedByUid = user.uid;
      if (!manualMeta.lastSavedBy) manualMeta.lastSavedBy = user.uid;
    }

    if (listingId === "new") {
      const nameText = (current.complex || (current as any).title || "").toString();
      const newId = await createListing(
        { title: nameText || "신규 매물", complex: nameText, ...patch } as Partial<ListingDoc> & {
          title: string;
        }
      );
      const firstComment = String(initialComment || "").trim();
      if (firstComment) {
        try {
          await createComment("listing", newId, firstComment);
        } catch {
          /* ignore comment failure */
        }
      }
    } else {
      await updateListing(listingId, { ...patch, ...manualMeta });
    }
    onClose();
  }

  async function handleComplete() {
    if (!draft) return;
    const current = draft;
    const today = new Date().toISOString().slice(0, 10);
    if (onComplete) {
      await onComplete(current as ListingDoc);
      onClose();
      return;
    }
    await updateListing(listingId, {
      status: "completed" as Listing["status"],
      isActive: false,
      closedAt: (current as any)?.closedAt ?? today,
      closedByUs: Boolean((current as any)?.closedByUs),
    });
    onClose();
  }

  async function handleReopen() {
    if (!draft) return;
    const current = draft;
    if (onReopen) {
      await onReopen(current as ListingDoc);
      onClose();
      return;
    }
    await restoreListing(listingId, "active", {
      closedAt: undefined,
      closedByUs: false,
      isActive: true,
    });
    onClose();
  }

  const fallbackUpdatedBy =
    (draft as any)?.updatedByName ??
    (draft as any)?.updatedByEmail ??
    (draft as any)?.updatedBy ??
    (draft as any)?.updatedByUid ??
    "";
  const savedAtValue =
    (draft as any)?.lastSavedAt ??
    (draft as any)?.updatedAt ??
    (draft as any)?.createdAt ??
    undefined;
  const savedAtText = savedAtValue ? formatTimestamp(savedAtValue) : "";
  const savedBy =
    (draft as any)?.lastSavedByName ??
    (draft as any)?.lastSavedBy ??
    (draft as any)?.lastSavedByEmail ??
    (draft as any)?.lastSavedByUid ??
    fallbackUpdatedBy;

  const renderActions = (extraClass = "") => (
    <div className={`flex flex-wrap gap-2 justify-end ${extraClass}`}>
      {actions?.save !== false ? (
        <button onClick={handleSave} className="h-9 px-3 rounded-lg ring-1 ring-neutral-300 text-sm">
          저장
        </button>
      ) : null}
      {actions?.complete ? (
        <button onClick={handleComplete} className="h-9 px-3 rounded-lg bg-neutral-900 text-white text-sm">
          거래 종료
        </button>
      ) : null}
      {actions?.reopen ? (
        <button onClick={handleReopen} className="h-9 px-3 rounded-lg ring-1 ring-neutral-300 text-sm">
          다시 진행
        </button>
      ) : null}
      <button onClick={onClose} className="h-9 px-3 rounded-lg ring-1 ring-neutral-300 text-sm">
        닫기
      </button>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4"
      onMouseDown={(e) => {
        overlayMouseDownRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && overlayMouseDownRef.current) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white w-full max-w-4xl rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-4" onChangeCapture={() => setIsEditing(true)}>
          <header className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-neutral-500">매물</div>
              <h3 className="text-lg font-bold mt-1">
                {(draft.complex ?? (draft as any).title ?? "-") + " "}
                <DongHo d={draft.dong} h={draft.ho} />
              </h3>
            </div>
            <div className="flex items-start gap-3 min-w-0">
              <div className="text-right min-w-0">
                {draft.agency ? (
                  <div className="text-[12px] text-neutral-600 truncate" title={String(draft.agency)}>
                    {String(draft.agency)}
                  </div>
                ) : null}
                <div className="text-sm text-neutral-900 truncate" title={draft.phone ? String(draft.phone) : undefined}>
                  {draft.phone ? (
                    <a href={`tel:${String(draft.phone).replace(/[^0-9+]/g, "")}`} className="hover:underline text-neutral-900">
                      {String(draft.phone)}
                    </a>
                  ) : (
                    "-"
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-full p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold text-neutral-700 mb-1">메모</div>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm min-h-[120px]"
                value={draft.memo ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    memo: e.target.value,
                  }))
                }
                placeholder={canEditMemo ? "메모를 입력하세요." : "권한 있는 사용자만 메모를 편집할 수 있습니다."}
                readOnly={!canEditMemo}
              />
            </div>
            <div>
  <div className="text-sm font-semibold text-neutral-700 mb-1">노출 메모 (뷰어)</div>
  <textarea
    className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
    value={draft.mobileMemo ?? ""}
    onChange={(e) =>
      setDraft((prev) => ({
        ...(prev ?? {}),
        mobileMemo: e.target.value,
      }))
    }
    placeholder="뷰어 리스트/상세에 노출할 1~2줄 메모를 입력하세요."
  />
  <div className="text-xs text-neutral-500 mt-1">* 비워두면 뷰어에 노출되지 않습니다.</div>
            </div>

            <div>
              {listingId === "new" ? (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-neutral-700">첫 댓글</div>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
                    placeholder="초기 메모 또는 댓글을 입력하면 저장 시 자동으로 등록됩니다."
                    value={initialComment}
                    onChange={(e) => setInitialComment(e.target.value)}
                  />
                  <div className="text-xs text-neutral-500">저장 후 댓글 목록이 활성화됩니다.</div>
                </div>
              ) : (
                <CommentThread entityType="listing" entityId={listingId} />
              )}
            </div>
            {renderActions("mt-1")}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <Field label="매물명">
              <input
                list={complexListId}
                className="w-full border rounded px-3 py-2 text-sm"
                value={(draft.complex ?? (draft as any).title ?? "") as any}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    complex: e.target.value,
                    title: e.target.value,
                  }))
                }
                placeholder="예) 반포르엘 102동"
              />
              <datalist id={complexListId}>
                {complexOptions.map((complex) => (
                  <option
                    key={complex.id}
                    value={complex.name}
                    label={
                      complex.region ? `${complex.region} · ${complex.name}` : complex.name
                    }
                  />
                ))}
              </datalist>
            </Field>
            <Field label="진행 상태">
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={(draft.status as string) ?? "active"}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    status: e.target.value as Listing["status"],
                  }))
                }
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="급매">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-neutral-300"
                  checked={Boolean((draft as any)?.urgent)}
                  onChange={(e) => setDraft((prev) => ({ ...(prev ?? {}), urgent: e.target.checked }))}
                />
                <span className="text-neutral-700">급매로 표시</span>
              </label>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="소유 구분">
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={(draft as any).ownershipType ?? "our"}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...(prev ?? {}),
                      ownershipType: e.target.value as "our" | "partner",
                    }))
                  }
                >
                  <option value="our">우리 물건</option>
                  <option value="partner">협업 물건</option>
                </select>
              </Field>
              <Field label="유형">
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={(draft.type as any) ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...(prev ?? {}),
                      type: e.target.value as any,
                    }))
                  }
                >
                  <option value="">선택</option>
                  <option value="매매">매매</option>
                  <option value="전세">전세</option>
                  <option value="월세">월세</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="면적(평)">
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={draft.area_py ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...(prev ?? {}),
                      area_py: numberFromInput(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field label="타입">
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={(draft as any)?.typeSuffix ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...(prev ?? {}),
                      typeSuffix: e.target.value,
                    }))
                  }
                />
              </Field>
            </div>
            <Field label="동 / 호">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="동"
                  value={draft.dong ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...(prev ?? {}),
                      dong: e.target.value,
                    }))
                  }
                />
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="호"
                  value={draft.ho ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...(prev ?? {}),
                      ho: e.target.value,
                    }))
                  }
                />
              </div>
            </Field>
            
<Field label="금액(만원)">
              <div className="grid grid-cols-3 gap-2">
                <input
                  placeholder="매매가"
                  className="border rounded px-2 py-1"
                  value={draft.price ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...(prev ?? {}),
                      price: numberFromInput(e.target.value) ?? undefined,
                    }))
                  }
                />
                <input
                  placeholder="보증금"
                  className="border rounded px-2 py-1"
                  value={draft.deposit ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...(prev ?? {}),
                      deposit: numberFromInput(e.target.value) ?? undefined,
                    }))
                  }
                />
                <input
                  placeholder="월세"
                  className="border rounded px-2 py-1"
                  value={draft.monthly ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...(prev ?? {}),
                      monthly: numberFromInput(e.target.value) ?? undefined,
                    }))
                  }
                />
              </div>
              <div className="text-xs text-neutral-500 mt-1">표시 금액: {formatPriceText(draft)}</div>
            </Field>
            <Field label="매물 접수일">
              <input
                type="date"
                className="w-full border rounded px-3 py-2 text-sm"
                value={(draft as any).receivedAt ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    receivedAt: e.target.value,
                  }))
                }
              />
            </Field>
            <Field label="만료일">
              <input
                type="date"
                className="w-full border rounded px-3 py-2 text-sm"
                value={(draft as any).expiryAt ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    expiryAt: e.target.value || undefined,
                  }))
                }
              />
            </Field>
            <Field label="계약 종료일">
              <input
                type="date"
                className="w-full border rounded px-3 py-2 text-sm"
                value={draft.closedAt ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    closedAt: e.target.value || undefined,
                  }))
                }
              />
            </Field>
            <Field label="직거래 여부">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!draft.closedByUs}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...(prev ?? {}),
                      closedByUs: e.target.checked || undefined,
                    }))
                  }
                />
                <span>우리(직거래) 체크</span>
              </label>
            </Field>
            <Field label="중개사">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={draft.agency ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    agency: e.target.value,
                  }))
                }
              />
            </Field>
            <Field label="소유주">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={(draft as any).owner ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    owner: (e.target as any).value,
                  }))
                }
              />
            </Field>
            <Field label="연락처">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={draft.phone ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    phone: e.target.value,
                  }))
                }
              />
            </Field>
            <Field label="담당자">
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={draft.assigneeUid ?? ""}
                onChange={(e) => {
                  const uid = e.target.value;
                  const selected = users.find((x) => x.uid === uid);
                  setDraft((prev) => ({
                    ...(prev ?? {}),
                    assigneeUid: uid || undefined,
                    assigneeName: uid ? selected?.name || selected?.email || "" : undefined,
                  }));
                }}
              >
                <option value="">선택</option>
                {users.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="최종 변경 정보">
              <div className="text-xs text-neutral-600 leading-tight space-y-0.5">
                <div>변경 시각: {savedAtText || "-"}</div>
                <div>최종 수정: {savedBy || "-"}</div>
              </div>
            </Field>
          </div>

          {renderActions("mt-4")}
        </div>
      </div>
    </div>
  );
}
