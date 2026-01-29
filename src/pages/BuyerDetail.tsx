import React from "react";
import { useParams, Link } from "react-router-dom";
import { useBuyers, updateBuyer } from "../lib/buyers";
import type { Buyer } from "../types/buyer";
import { useComments as useFsComments } from "../lib/comments";
import { useAuth } from "../context/AuthContext";

const matchUserIdentifier = (user: any, identifier?: string | null) => {
  const target = String(identifier || "").trim().toLowerCase();
  if (!target || !user) return false;
  const tokens = [
    String((user as any)?.uid || ""),
    String((user as any)?.email || ""),
    String((user as any)?.name || ""),
    String((user as any)?.displayName || ""),
  ]
    .map((token) => String(token || "").trim().toLowerCase())
    .filter(Boolean);
  return tokens.includes(target);
};

const canSeeBuyerPhone = (user: any, buyer: any) => {
  if (!user || !buyer) return false;
  const email = String((user as any)?.email || "").toLowerCase();
  const role = (user as any)?.role;
  const isAdmin = role === "owner" || role === "admin";
  if (isAdmin) return true;
  if (matchUserIdentifier(user, buyer?.assignedTo)) return true;
  if (matchUserIdentifier(user, buyer?.assignedToEmail)) return true;
  if (matchUserIdentifier(user, buyer?.assignedToName)) return true;
  if (matchUserIdentifier(user, buyer?.createdByUid)) return true;
  if (matchUserIdentifier(user, buyer?.createdByEmail)) return true;
  return false;
};

const toNumber = (value: any) => {
  if (value == null) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const formatRange = (min?: number, max?: number, unit = "") => {
  if (min == null && max == null) return "-";
  const fmt = (value?: number) => (value != null ? `${value.toLocaleString()}${unit}` : "-");
  if (min != null && max != null) return `${fmt(min)} ~ ${fmt(max)}`;
  if (min != null) return `${fmt(min)} 이상`;
  return `${fmt(max)} 이하`;
};

const formatBudgetRange = (min?: number, max?: number) => formatRange(min, max, "만원");
const formatAreaRange = (min?: number, max?: number) => formatRange(min, max, "평");
const formatMonthlyValue = (value?: number) => (value != null ? `${value.toLocaleString()}만원` : "-");

export function BuyerDetailView({ buyer, canSeePhone }: { buyer: Buyer; canSeePhone: boolean }) {

  const toDateText = (v: any) => new Date(v?.toMillis?.() ?? v ?? Date.now()).toLocaleDateString();

  const typePrefs = (buyer as any).typePrefs?.join(", ") || "-";

  const areaPrefs = (buyer as any).areaPrefsPy?.join(", ") || "-";

  const complexPrefs = (buyer as any).complexPrefs?.join(", ") || "-";

  const floors = (buyer as any).floors?.join(", ") || "-";

  const mustHaves = (buyer as any).mustHaves?.join(", ") || "-";

  const assignedDisplay =

    (buyer as any).assignedToName || (buyer as any).assignedToEmail || (buyer as any).assignedTo || "-";

  const wantsMonthly = ((buyer as any)?.typePrefs ?? []).includes("??");

  const monthlyValue = formatMonthlyValue(toNumber((buyer as any)?.monthlyMax));

  const showMonthlyField = wantsMonthly || toNumber((buyer as any)?.monthlyMax) != null;

  const budgetRange = formatBudgetRange(toNumber((buyer as any)?.budgetMin), toNumber((buyer as any)?.budgetMax));

  const areaRange = formatAreaRange(toNumber((buyer as any)?.areaMinPy), toNumber((buyer as any)?.areaMaxPy));

  const phoneNode = canSeePhone ? ((buyer as any).phone ?? "-") : <span className="text-neutral-400">???</span>;



  return (

    <div className="space-y-3">

      <div className="grid grid-cols-2 gap-3 text-sm">

        <Field label="??">{(buyer as any).name}</Field>

        <Field label="???">{phoneNode}</Field>

        <Field label="소유자명">{(buyer as any).ownerName || "-"}</Field>

        <Field label="??">{budgetRange}</Field>

        {showMonthlyField ? <Field label="?? ??">{monthlyValue}</Field> : null}

        <Field label="??(?? ??)">{(buyer as any).budgetText || "-"}</Field>

        <Field label="?? ??">{typePrefs}</Field>

        <Field label="?? ?? ??(?)">{areaRange}</Field>

        <Field label="?? ??">{areaPrefs}</Field>

        <Field label="?? ??">{complexPrefs}</Field>

        <Field label="?? ??">{floors}</Field>

        <Field label="?? ??">{mustHaves}</Field>

        <Field label="???">{assignedDisplay}</Field>

        <Field label="???">{toDateText((buyer as any).createdAt)}</Field>

      </div>



      <div>

        <div className="text-sm font-semibold mb-1">??</div>

        <div className="text-sm text-neutral-700 whitespace-pre-wrap min-h-[80px] p-3 rounded-xl ring-1 ring-neutral-200 bg-neutral-50">

          {(buyer as any).notes || "-"}

        </div>

      </div>

    </div>

  );

}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-50 rounded-xl px-3 py-2 ring-1 ring-neutral-200">
      <div className="text-[12px] text-neutral-500">{label}</div>
      <div className="font-medium">{children}</div>
    </div>
  );
}

export default function BuyerDetail() {
  const rows = useBuyers();
  const { id } = useParams();
  const buyer = (rows as any[]).find((b) => b.id === (id ?? ""));
  const [budgetText, setBudgetText] = React.useState<string>(String((buyer as any)?.budgetText ?? ""));
  const { user } = useAuth();

  const canSeePhone = React.useMemo(() => canSeeBuyerPhone(user, buyer), [buyer, user]);

  // Firestore 댓글 로드 + 최신 댓글을 Buyer 문서에 반영
  const comments = useFsComments("buyer", id ?? null);
  React.useEffect(() => {
    const buyerId = id ?? "";
    if (!buyerId) return;
    const current = (rows as any[]).find((b) => b.id === buyerId) as any;
    if (!comments || comments.length === 0) {
      if (current?.lastCommentText || current?.lastCommentAt || current?.lastCommentAuthor) {
        updateBuyer(buyerId, { lastCommentText: "", lastCommentAt: undefined as any, lastCommentAuthor: undefined as any } as any);
      }
      return;
    }
    const last = comments[comments.length - 1] as any;
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
  }, [id, rows, comments]);

  if (!buyer) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="text-neutral-600">해당 매수자를 찾을 수 없습니다.</div>
        <Link to="/buyers" className="text-blue-600 underline">목록으로</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 min-h-screen overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">매수자 상세</h1>
        <Link to="/buyers" className="text-sm text-blue-600 underline">목록으로</Link>
      </div>
      <BuyerDetailView buyer={buyer as any} canSeePhone={canSeePhone} />
      <div className="mt-6">
        <div className="text-sm text-neutral-700 font-semibold mb-2">예산(직접 입력)</div>
        <input
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="예: 23억~34억"
          value={budgetText}
          onChange={(e) => setBudgetText(e.target.value)}
          onBlur={(e) => updateBuyer(String(id), { budgetText: e.target.value } as any)}
        />
        <div className="text-xs text-neutral-500 mt-1">숫자/단위를 자유롭게 입력하세요. 필드에서 벗어나면 자동 저장됩니다.</div>
      </div>
    </div>
  );
}
