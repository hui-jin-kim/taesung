import React from "react";
import Navbar from "../components/AppNavbar";
import { useNavigate, useParams } from "react-router-dom";
import { useListings, updateListing } from "../state/useListings";
import type { Listing } from "../types/core";
import Comments from "../components/Comments";
import { useAuth } from "../context/AuthContext";
import { softDeleteListings } from "../lib/delete";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-[12px] text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

const numberFrom = (v: string) => {
  if (!v) return undefined;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const rows = useListings();
  const found = rows.find((r) => r.id === id);
  const [draft, setDraft] = React.useState<Partial<Listing> | null>(found ? { ...found } : null);
  const { user } = useAuth();

  React.useEffect(() => {
    const next = rows.find((r) => r.id === id);
    setDraft(next ? { ...next } : null);
  }, [rows, id]);

  if (!id || !draft) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-6 py-10">매물을 찾을 수 없습니다.</div>
      </div>
    );
  }

  const canEditMemo = React.useMemo(() => {
    const email = String(user?.email || "").toLowerCase();
    if (!user) return false;
    const role = (user as any)?.role;
    if (role === "owner" || role === "admin") return true;
    const assigneeUid = (draft as any)?.assigneeUid;
    if (assigneeUid && user.uid && assigneeUid === user.uid) return true;
    return false;
  }, [user, (draft as any)?.assigneeUid]);

  const handleSave = async () => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = draft as any;
    await updateListing(id, {
      ...rest,
      area_py: rest.area_py ?? undefined,
      areaSuffix: rest.areaSuffix ?? (rest.areaSuffix === "" ? "" : undefined),
      price: rest.price ?? undefined,
      deposit: rest.deposit ?? undefined,
      monthly: rest.monthly ?? undefined,
    });
    alert("저장되었습니다.");
  };

  const handleDelete = async () => {
    if (!confirm("삭제하시겠습니까?\n(휴지통에서 복구가 가능합니다)")) return;
    await softDeleteListings([id]);
    nav("/listings");
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">매물 수정</h1>
          <button className="text-sm text-neutral-500" onClick={() => nav("/listings")}>
            뒤로가기
          </button>
        </div>

        <div className="bg-white rounded-2xl ring-1 ring-neutral-200 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Labeled label="동">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={draft.dong ?? ""}
                onChange={(e) => setDraft((p) => ({ ...(p ?? {}), dong: e.target.value }))}
              />
            </Labeled>
            <Labeled label="호">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={draft.ho ?? ""}
                onChange={(e) => setDraft((p) => ({ ...(p ?? {}), ho: e.target.value }))}
              />
            </Labeled>
            <Labeled label="면적(평)">
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 border rounded px-3 py-2 text-sm"
                  value={draft.area_py ?? ""}
                  onChange={(e) => setDraft((p) => ({ ...(p ?? {}), area_py: numberFrom(e.target.value) }))}
                />
                <input
                  className="w-20 border rounded px-3 py-2 text-sm uppercase"
                  placeholder="예: A"
                  maxLength={3}
                  value={draft.areaSuffix ?? ""}
                  onChange={(e) =>
                    setDraft((p) => ({ ...(p ?? {}), areaSuffix: e.target.value ? e.target.value.toUpperCase() : "" }))
                  }
                />
              </div>
            </Labeled>
            <Labeled label="종류">
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={draft.type ?? ""}
                onChange={(e) => setDraft((p) => ({ ...(p ?? {}), type: e.target.value as Listing["type"] }))}
              >
                <option value="">선택</option>
                <option value="매매">매매</option>
                <option value="전세">전세</option>
                <option value="월세">월세</option>
              </select>
            </Labeled>
            <Labeled label="매매(만원)">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={draft.price ?? ""}
                onChange={(e) => setDraft((p) => ({ ...(p ?? {}), price: numberFrom(e.target.value) }))}
              />
            </Labeled>
            <Labeled label="보증금(만원)">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={draft.deposit ?? ""}
                onChange={(e) => setDraft((p) => ({ ...(p ?? {}), deposit: numberFrom(e.target.value) }))}
              />
            </Labeled>
            <Labeled label="월세(만원)">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={draft.monthly ?? ""}
                onChange={(e) => setDraft((p) => ({ ...(p ?? {}), monthly: numberFrom(e.target.value) }))}
              />
            </Labeled>
            <Labeled label="접수일">
              <input
                type="date"
                className="w-full border rounded px-3 py-2 text-sm"
                value={(draft as any).receivedAt ?? ""}
                onChange={(e) => setDraft((p) => ({ ...(p ?? {}), receivedAt: e.target.value as any }))}
              />
            </Labeled>
            <Labeled label="계약 완료일">
              <input
                type="date"
                className="w-full border rounded px-3 py-2 text-sm"
                value={(draft as any).closedAt ?? ""}
                onChange={(e) => setDraft((p) => ({ ...(p ?? {}), closedAt: e.target.value as any }))}
              />
            </Labeled>
            <div className="sm:col-span-2">
              <Labeled label="메모">
                <textarea
                  className="w-full border rounded px-3 py-2 text-sm min-h-[120px]"
                  value={draft.memo ?? ""}
                  onChange={(e) => setDraft((p) => ({ ...(p ?? {}), memo: e.target.value }))}
                  placeholder={canEditMemo ? "메모를 입력하세요." : "담당자/관리자만 수정 가능합니다"}
                  readOnly={!canEditMemo}
                />
              </Labeled>
            </div>
            <div className="sm:col-span-2">
              <Labeled label="노출 메모 (뷰어)">
                <textarea
                  className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
                  value={draft.mobileMemo ?? ""}
                  onChange={(e) => setDraft((p) => ({ ...(p ?? {}), mobileMemo: e.target.value }))}
                  placeholder="뷰어 리스트/상세에 노출할 1~2줄 메모를 입력하세요."
                />
                <span className="text-xs text-neutral-500">* 비워두면 뷰어에 노출되지 않습니다.</span>
              </Labeled>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-base font-semibold mb-2">댓글</h2>
            <Comments parentType="listing" parentId={id} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={handleSave} className="h-9 px-3 rounded-lg bg-neutral-900 text-white text-sm">
              저장
            </button>
            <button onClick={handleDelete} className="h-9 px-3 rounded-lg ring-1 ring-neutral-300 text-sm">
              삭제
            </button>
            <button onClick={() => nav("/listings")} className="h-9 px-3 rounded-lg ring-1 ring-neutral-300 text-sm">
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
