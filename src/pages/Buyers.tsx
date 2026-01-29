import React from "react";
import { useNavigate } from "react-router-dom";
import { Search, Square, CheckSquare, Trash2, Building2, Target } from "lucide-react";

import Navbar from "../components/AppNavbar";
import BuyerNewSheet from "../components/BuyerNewSheet";
import BuyerDetailSheet from "../components/BuyerDetailSheet";
import { useAuth } from "../context/AuthContext";
import { useBuyers } from "../state/useBuyers";
import { useMatches } from "../state/useMatches";
import { useUserDirectory } from "../state/useUserDirectory";
import { softDeleteBuyers } from "../lib/delete";
import { useSelection } from "../context/SelectionContext";
import {
  useBuyerMatchMemory,
  rememberBuyerMatches,
  type BuyerMatchMemory,
} from "../state/useBuyerMatchMemory";
import { storeMatchBuffer } from "../lib/matchBuffer";

type BuyerStatusFilter = "active" | "hold" | "completed";
type BuyerTypeFilter = "ALL" | "매매" | "전세" | "월세";
type ViewMode = "cards" | "list";
const VIEW_STORAGE_KEY = "rj_buyers_view";

function formatBudget(min?: number, max?: number) {
  const fmt = (value?: number) => (value != null ? `${value.toLocaleString()}만원` : "-");
  if (min == null && max == null) return "-";
  if (min != null && max != null) return `${fmt(min)} ~ ${fmt(max)}`;
  if (min != null) return `${fmt(min)} 이상`;
  return `${fmt(max)} 이하`;
}

function formatArray(values?: Array<string | number>, suffix = "") {
  if (!values || values.length === 0) return "-";
  return values.map((v) => `${v}${suffix}`).join(", ");
}

const formatTypePrefs = (values?: string[]) => (values && values.length ? values.join(", ") : "모든 유형");

const STATUS_TABS: Array<{ value: BuyerStatusFilter; label: string }> = [
  { value: "active", label: "진행" },
  { value: "hold", label: "보류" },
  { value: "completed", label: "완료" },
];

function normalizeBuyerStatus(status?: string | null): BuyerStatusFilter {
  const text = String(status ?? "").trim().toLowerCase();
  if (text === "hold") return "hold";
  if (text === "completed" || text === "archived") return "completed";
  return "active";
}

function matchesUserIdentifier(user: any, identifier?: string | null) {
  const target = String(identifier || "").trim().toLowerCase();
  if (!target || !user) return false;
  const tokens = [
    String(user?.uid || ""),
    String(user?.email || ""),
    String((user as any)?.name || ""),
    String((user as any)?.displayName || ""),
  ]
    .map((token) => String(token || "").trim().toLowerCase())
    .filter(Boolean);
  return tokens.includes(target);
}

function canSeePhone(user: any, buyer: any): boolean {
  if (!user) return false;
  const role = user?.role;
  const isAdmin = role === "owner" || role === "admin";
  if (isAdmin) return true;
  if (matchesUserIdentifier(user, buyer?.assignedToEmail)) return true;
  if (matchesUserIdentifier(user, buyer?.assignedToName)) return true;
  if (matchesUserIdentifier(user, buyer?.assignedTo)) return true;
  if (matchesUserIdentifier(user, buyer?.createdByUid)) return true;
  if (matchesUserIdentifier(user, buyer?.createdByEmail)) return true;
  return false;
}

function canManageBuyer(user: any, buyer: any): boolean {
  if (!user || !buyer) return false;
  const role = user?.role;
  const isAdmin = role === "owner" || role === "admin";
  if (isAdmin) return true;
  if (matchesUserIdentifier(user, buyer?.assignedToEmail)) return true;
  if (matchesUserIdentifier(user, buyer?.assignedToName)) return true;
  if (matchesUserIdentifier(user, buyer?.assignedTo)) return true;
  return false;
}

type BuyerCardProps = {
  buyer: any;
  selected: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
  matchCount: number;
  onMatchSelect: () => void;
  hasSavedMatches: boolean;
  highlighted?: boolean;
};

type BuyerListViewProps = {
  buyers: any[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onOpenDetail: (id: string) => void;
  matches: any;
  onMatchSelect: (buyerId: string, listingIds: string[]) => void;
  matchMemory: BuyerMatchMemory;
  highlightedId?: string | null;
};

function toneForType(type?: string) {
  const k = String(type || "");
  if (k.includes("매매")) return "text-rose-800 bg-rose-100 border border-rose-200";
  if (k.includes("전세")) return "text-sky-800 bg-sky-100 border border-sky-200";
  if (k.includes("월세")) return "text-amber-800 bg-amber-100 border border-amber-200";
  return "text-white bg-neutral-900";
}

export default function Buyers() {
  const rows = useBuyers() as any[];
  const matches = useMatches();
  const { user } = useAuth();
  const nav = useNavigate();
  const { setMany } = useSelection("listings");
  const matchMemory = useBuyerMatchMemory();
  const { getName } = useUserDirectory();

  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<BuyerStatusFilter>("active");
  const [typeFilter, setTypeFilter] = React.useState<BuyerTypeFilter>("ALL");
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>("ALL");
  const [viewMode, setViewMode] = React.useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      return stored === "list" || stored === "cards" ? (stored as ViewMode) : "cards";
    } catch {
      return "cards";
    }
  });
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [newOpen, setNewOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [recentlyCreatedId, setRecentlyCreatedId] = React.useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);

  const handleMatchSelect = React.useCallback(
    (buyerId: string, listingIds: string[]) => {
      if (!buyerId || listingIds.length === 0) return;
      setMany(listingIds);
      rememberBuyerMatches(buyerId, listingIds);
      storeMatchBuffer(buyerId, listingIds);
      nav(`/selected?fromBuyer=${encodeURIComponent(buyerId)}`, {
        state: { matchedIds: listingIds, fromBuyerId: buyerId },
      } as any);
    },
    [nav, setMany]
  );

  React.useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  const items = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.slice().map((b) => {
      let rec = String(b?.receivedDate || "");
      if (!rec) {
        const ca: any = b?.createdAt;
        const toMs = typeof ca?.toMillis === "function" ? ca.toMillis() : typeof ca === "number" ? ca : undefined;
        if (toMs) {
          const d = new Date(toMs);
          rec = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        }
      }
      const assignedDisplayRaw =
        getName(String(b?.assignedTo || ""), String(b?.assignedToEmail || b?.assignedTo || "")) ||
        b?.assignedToName ||
        b?.assignedToEmail ||
        b?.assignedTo ||
        "";
      const assignedDisplay = assignedDisplayRaw || "미배정";
      return { ...b, _recDate: rec, _assignedDisplay: assignedDisplay };
    });

    list = list.filter((b) => normalizeBuyerStatus(b?.status) === statusFilter);

    if (typeFilter !== "ALL") {
      list = list.filter((b) => {
        const prefs = Array.isArray(b?.typePrefs) ? b.typePrefs : [];
        if (prefs.length === 0) return true;
        return prefs.some((pref: any) => String(pref) === typeFilter);
      });
    }

    if (q) {
      list = list.filter((b) => {
        const budgetLabel = formatBudget(b?.budgetMin, b?.budgetMax);
        const areaPreferred = Array.isArray(b?.areaPrefsPy) ? b.areaPrefsPy.map((v: any) => String(v)).join(" ") : "";
        const hay = [
          b.name,
          b.phone,
          b.notes,
          ...(b.mustHaves ?? []),
          ...(b.complexPrefs ?? []),
          ...(b.typePrefs ?? []),
          b?._assignedDisplay,
          budgetLabel,
          areaPreferred,
          b?.budgetMin,
          b?.budgetMax,
          b?.areaMinPy,
          b?.areaMaxPy,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    if (assigneeFilter !== "ALL") {
      list = list.filter((b) => (b._assignedDisplay || "미배정") === assigneeFilter);
    }

    return list;
  }, [rows, query, assigneeFilter, getName, statusFilter, typeFilter]);

  const assigneeOptions = React.useMemo(() => {
    const set = new Set<string>();
    rows.forEach((b: any) => {
      const assignedDisplay =
        getName(String(b?.assignedTo || ""), String(b?.assignedToEmail || b?.assignedTo || "")) ||
        b?.assignedToName ||
        b?.assignedToEmail ||
        b?.assignedTo ||
        "";
      set.add(assignedDisplay || "미배정");
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
  }, [rows, getName]);

  const totalCount = items.length;
  const selectedCount = selectedIds.length;
  const selectedBuyers = React.useMemo(() => {
    const byId = new Map<string, any>();
    (rows as any[]).forEach((buyer: any) => {
      if (buyer?.id) byId.set(buyer.id, buyer);
    });
    return selectedIds.map((id) => byId.get(id)).filter(Boolean);
  }, [rows, selectedIds]);
  const canDeleteSelected =
    selectedCount > 0 &&
    selectedBuyers.length === selectedCount &&
    selectedBuyers.every((buyer) => canManageBuyer(user, buyer));

  React.useEffect(() => {
    if (!recentlyCreatedId) return;
    const el = document.getElementById(`buyer-card-${recentlyCreatedId}`);
    if (!el) return;
    if (typeof el.scrollIntoView === "function") {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        /* ignore */
      }
    }
    const timer = window.setTimeout(() => setRecentlyCreatedId(null), 2500);
    return () => window.clearTimeout(timer);
  }, [recentlyCreatedId, items, viewMode]);

  const onToggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleClearSelection = React.useCallback(() => setSelectedIds([]), []);

  const handleDeleteSelected = React.useCallback(async () => {
    if (!canDeleteSelected || selectedCount === 0 || bulkDeleting) return;
    const ok = window.confirm(`선택 ${selectedCount}명의 매수자를 삭제하시겠습니까?`);
    if (!ok) return;
    setBulkDeleting(true);
    try {
      await softDeleteBuyers(selectedIds);
      setSelectedIds([]);
    } catch (error) {
      console.error(error);
      alert("삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBulkDeleting(false);
    }
  }, [bulkDeleting, canDeleteSelected, selectedCount, selectedIds]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-4">
        <header className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-1">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="w-full h-11 rounded-full border border-neutral-200 pl-10 pr-4 text-sm"
                  placeholder="이름, 메모, 예산·희망 단지·면적 검색"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white p-1 w-full sm:w-auto">
                {STATUS_TABS.map((tab) => {
                  const active = statusFilter === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setStatusFilter(tab.value)}
                      className={`px-3 py-1 rounded-full text-xs transition ${
                        active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              className="h-11 px-6 rounded-full bg-neutral-900 text-white text-sm w-full sm:w-auto"
              onClick={() => setNewOpen(true)}
            >
              새 매수 등록
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm lg:justify-end">
            <select
              className="h-9 rounded-lg border border-neutral-200 px-3"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
            >
              <option value="ALL">담당자 전체</option>
              {assigneeOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-lg border border-neutral-200 px-3"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as BuyerTypeFilter)}
            >
              <option value="ALL">거래 유형 전체</option>
              <option value="매매">매매</option>
              <option value="전세">전세</option>
              <option value="월세">월세</option>
            </select>
            <div className="flex items-center gap-1 border rounded-full px-2 py-1 ml-auto">
              <button className={`px-3 py-1 rounded-full text-xs ${viewMode === "cards" ? "bg-neutral-900 text-white" : ""}`} onClick={() => setViewMode("cards")}>
                카드
              </button>
              <button className={`px-3 py-1 rounded-full text-xs ${viewMode === "list" ? "bg-neutral-900 text-white" : ""}`} onClick={() => setViewMode("list")}>
                목록
              </button>
            </div>
          </div>
        </header>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-neutral-600">
          <span>선택 {selectedCount}건</span>
          <span>·</span>
          <span>총 {totalCount.toLocaleString()}건</span>
          {selectedCount > 0 ? (
            <>
              <button
                type="button"
                onClick={handleClearSelection}
                className="ml-1 px-2 py-1 rounded-full border border-neutral-300 text-[11px] sm:text-xs text-neutral-600"
              >
                선택 해제
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={!canDeleteSelected || bulkDeleting}
                className={`px-2 py-1 rounded-full border text-[11px] sm:text-xs ${
                  canDeleteSelected && !bulkDeleting
                    ? "border-rose-600 text-rose-700 hover:bg-rose-50"
                    : "border-neutral-300 text-neutral-400 cursor-not-allowed"
                }`}
              >
                {bulkDeleting ? "삭제 중..." : "선택 삭제"}
              </button>
              {!canDeleteSelected ? (
                <span className="text-[11px] text-rose-500">담당자 또는 관리자만 삭제할 수 있습니다.</span>
              ) : null}
            </>
          ) : null}
        </div>

        <section className="mt-4">
          {viewMode === "cards" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((b) => {
                const autoMatchIds = (matches.getForBuyer?.(b.id, 10) ?? []).map((m: any) => m.id);
                const savedEntry = matchMemory?.[b.id];
                const savedIds = Array.isArray(savedEntry?.ids) ? savedEntry.ids : [];
                const matchIds = savedIds.length > 0 ? savedIds : autoMatchIds;
                const hasSavedMatches = savedIds.length > 0;
                return (
                  <BuyerCard
                    key={b.id}
                    buyer={b}
                    selected={selectedIds.includes(b.id)}
                    onToggle={() => onToggle(b.id)}
                    onOpenDetail={() => setDetailId(b.id)}
                    matchCount={matchIds.length}
                    onMatchSelect={() => handleMatchSelect(b.id, matchIds)}
                    hasSavedMatches={hasSavedMatches}
                    highlighted={recentlyCreatedId === b.id}
                  />
                );
              })}
            </div>
          ) : (
            <BuyerListView
              buyers={items}
              selectedIds={selectedIds}
              onToggle={onToggle}
              onOpenDetail={(id) => setDetailId(id)}
              matches={matches}
              onMatchSelect={handleMatchSelect}
              matchMemory={matchMemory}
              highlightedId={recentlyCreatedId}
            />
          )}
        </section>

        <BuyerNewSheet
          open={newOpen}
          onClose={() => setNewOpen(false)}
          onCreated={(id) => {
            setNewOpen(false);
            setDetailId(null);
            if (id) setRecentlyCreatedId(id);
          }}
        />
        {detailId ? <BuyerDetailSheet open buyerId={detailId} onClose={() => setDetailId(null)} /> : null}
      </div>
    </div>
  );
}

function BuyerCard({ buyer, selected, onToggle, onOpenDetail, matchCount, onMatchSelect, hasSavedMatches, highlighted }: BuyerCardProps) {
  const { getName } = useUserDirectory();
  const { user } = useAuth();
  const canDial = canSeePhone(user, buyer);
  const phoneText = canDial ? String(buyer?.phone || "") : "비공개";
  const canManage = canManageBuyer(user, buyer);

  const budget = formatBudget(buyer?.budgetMin, buyer?.budgetMax);
  const complexPrefs = formatArray(buyer?.complexPrefs);
  const areaPrefs = formatArray(buyer?.areaPrefsPy, "평");
  const chipLabel = formatTypePrefs(buyer?.typePrefs);

  const assignedRaw = buyer?.assignedTo || "";
  const assignedLabel =
    getName(String(assignedRaw), String(buyer?.assignedToEmail || assignedRaw)) ||
    buyer?.assignedToName ||
    buyer?.assignedToEmail ||
    String(assignedRaw || "");

  const latestComment = String(buyer?.lastCommentText || "").trim();
  const firstType = Array.isArray(buyer?.typePrefs) ? String(buyer.typePrefs[0] || "") : "";

  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!canManage) {
      alert("담당자 또는 관리자만 삭제할 수 있습니다.");
      return;
    }
    if (confirm("해당 매수자를 삭제하시겠습니까?\n(삭제 후 복구는 관리자에게 문의하세요)")) {
      try {
        await softDeleteBuyers([buyer.id]);
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div
      id={`buyer-card-${buyer.id}`}
      className={`relative flex flex-col bg-white rounded-3xl border px-4 py-4 shadow-sm transition hover:shadow-md min-h-[320px] ${
        selected ? "border-neutral-900" : "border-neutral-200"
      } ${highlighted ? "ring-2 ring-emerald-300" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium ${toneForType(firstType)}`}>
          {chipLabel}
        </span>
        <div className="flex items-center gap-2">
          {matchCount > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMatchSelect();
              }}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border hover:bg-emerald-50 ${
                hasSavedMatches ? "text-sky-800 bg-sky-100 border-sky-200" : "text-emerald-800 bg-emerald-100 border-emerald-200"
              }`}
              title={hasSavedMatches ? "저장된 매칭 보기" : "즉시 매칭 보기"}
            >
              매칭 <span className="font-semibold">{matchCount}</span>
              {hasSavedMatches ? <span className="text-[10px] font-normal">저장</span> : null}
            </button>
          ) : (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] text-neutral-400 bg-neutral-100 border border-neutral-200">매칭 0</span>
          )}
          <button
            className={`rounded-lg p-1.5 bg-white shadow ring-1 ${canManage ? "ring-rose-200 text-rose-700 hover:bg-rose-50" : "ring-neutral-200 text-neutral-300 cursor-not-allowed"}`}
            title={canManage ? "삭제" : "담당자 또는 관리자만 삭제 가능"}
            onClick={handleDelete}
            disabled={!canManage}
            type="button"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="rounded-lg p-1.5 bg-white shadow ring-1 ring-neutral-200"
            aria-label="select buyer"
          >
            {selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="mt-4 flex-1 flex flex-col gap-2">
        <div className="text-lg font-semibold text-neutral-900 truncate">{buyer?.name || "-"}</div>
        {buyer?.ownerName ? (
          <div className="text-sm text-neutral-500">소유자 {buyer.ownerName}</div>
        ) : null}
        <div className="mt-1 text-xs text-neutral-500">접수 {String((buyer as any)._recDate || buyer?.receivedDate || "-")}</div>
        <div className="mt-1 text-xs text-neutral-500">{assignedLabel || "-"}</div>
        <div className="mt-2 flex items-center gap-2 text-[13px] text-neutral-700">
          <Target className="w-4 h-4 text-neutral-400" />
          <span>예산 {budget}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[13px] text-neutral-700">
          <Building2 className="w-4 h-4 text-neutral-400" />
          <span>희망 단지 {complexPrefs}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[13px] text-neutral-700">
          <Building2 className="w-4 h-4 text-neutral-400" />
          <span>희망 면적 {areaPrefs}</span>
        </div>
        <div className="text-sm text-neutral-900 line-clamp-2 min-h-[2.25rem]">{String(buyer?.notes || "\u00A0")}</div>
        {latestComment ? (
          <div className="mt-1 text-[12px] text-emerald-700 bg-emerald-50 rounded px-2 py-1 line-clamp-2 min-h-[2.25rem]">{latestComment}</div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-neutral-200 text-sm text-neutral-800 hover:bg-neutral-100"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail();
          }}
        >
          자세히 보기
        </button>
        {canDial ? (
          <a href={`tel:${phoneText.replace(/[^0-9+]/g, "")}`} className="text-base font-semibold text-neutral-900 hover:underline">
            {phoneText || "-"}
          </a>
        ) : (
          <span className="text-sm text-neutral-400">{phoneText}</span>
        )}
      </div>
    </div>
  );
}

function BuyerListView({ buyers, selectedIds, onToggle, onOpenDetail, matches, onMatchSelect, matchMemory, highlightedId }: BuyerListViewProps) {
  const { user } = useAuth();
  const { getName } = useUserDirectory();
  return (
    <div className="space-y-2">
      {buyers.map((buyer) => {
        const selected = selectedIds.includes(buyer.id);
        const canDial = canSeePhone(user, buyer);
        const phone = canDial ? String(buyer?.phone || "") : "비공개";
        const budget = formatBudget(buyer?.budgetMin, buyer?.budgetMax);
        const complexPrefs = formatArray(buyer?.complexPrefs);
        const areaPrefs = formatArray(buyer?.areaPrefsPy, "평");
        const assignedRaw = buyer?.assignedTo || "";
        const assignedLabel =
          getName(String(assignedRaw), String(buyer?.assignedToEmail || assignedRaw)) ||
          buyer?.assignedToName ||
          buyer?.assignedToEmail ||
          String(assignedRaw || "");
        const latestText = String(buyer?.lastCommentText || "").trim();
        const matchEntries = matches?.getForBuyer ? matches.getForBuyer(buyer.id, 50) : [];
        const autoIds = matchEntries.map((m: any) => m.id);
        const savedEntry = matchMemory?.[buyer.id];
        const savedIds = Array.isArray(savedEntry?.ids) ? savedEntry.ids : [];
        const matchIds = savedIds.length > 0 ? savedIds : autoIds;
        const matchCount = matchIds.length;
        const hasSavedMatches = savedIds.length > 0;
        const highlighted = highlightedId === buyer.id;
        return (
          <div
            key={buyer.id}
            id={`buyer-card-${buyer.id}`}
            className={`bg-white rounded-2xl border px-4 py-3 transition hover:shadow ${
              selected ? "border-neutral-900" : "border-neutral-200"
            } ${highlighted ? "ring-2 ring-emerald-300" : ""}`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <div className="grid grid-cols-[20px,1fr] gap-2 items-start">
                <button type="button" onClick={() => onToggle(buyer.id)} className="mt-0.5" aria-label="select buyer">
                  {selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                </button>
                <div>
                  <div className="text-sm sm:text-base font-semibold">{buyer?.name || "-"}</div>
                  {buyer?.ownerName ? (
                    <div className="text-xs text-neutral-500 mt-1">소유자 {buyer.ownerName}</div>
                  ) : null}
                  <div className="text-xs text-neutral-500 mt-1">예산 {budget}</div>
                  <div className="text-xs text-neutral-500">희망 단지 {complexPrefs}</div>
                  <div className="text-xs text-neutral-500">희망 면적 {areaPrefs}</div>
                </div>
              </div>
              <div className="text-sm text-neutral-700 min-w-0">
                <div className="line-clamp-2">{buyer?.notes || "-"}</div>
                {latestText ? <div className="mt-2 text-[12px] text-emerald-700 bg-emerald-50 rounded px-2 py-1 line-clamp-1">{latestText}</div> : null}
              </div>
              <div className="flex flex-col items-end gap-2 text-right">
                <div className="flex items-center gap-2">
                  {(() => {
                    const tset = new Set<string>(buyer?.typePrefs || []);
                    const ordered: Array<[string, string]> = [
                      ["매매", "text-rose-800 bg-rose-100 border border-rose-200"],
                      ["전세", "text-sky-800 bg-sky-100 border border-sky-200"],
                      ["월세", "text-amber-800 bg-amber-100 border border-amber-200"],
                    ];
                    const nodes = ordered
                      .filter(([label]) => tset.has(label))
                      .map(([label, className]) => (
                        <span key={label} className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] ${className}`}>
                          {label}
                        </span>
                      ));
                    if (nodes.length === 0) return null;
                    return <div className="hidden sm:flex items-center gap-1.5 mr-1">{nodes}</div>;
                  })()}
                  {matchCount > 0 ? (
                    <button
                      type="button"
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] border ${
                        hasSavedMatches ? "text-sky-800 bg-sky-100 border-sky-200" : "text-emerald-800 bg-emerald-100 border-emerald-200"
                      }`}
                      onClick={() => onMatchSelect(buyer.id, matchIds)}
                    >
                      매칭 <span className="font-semibold">{matchCount}</span>
                      {hasSavedMatches ? <span className="text-[10px] font-normal ml-0.5">저장</span> : null}
                    </button>
                  ) : (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] text-neutral-400 bg-neutral-100">매칭 0</span>
                  )}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] sm:text-xs px-2 py-1 rounded-lg bg-white ring-1 ring-rose-300 text-rose-700 hover:bg-rose-50"
                    title="삭제"
                    onClick={async () => {
                      if (confirm("해당 매수자를 삭제할까요?\n(보관함에서 복구 가능합니다)")) {
                        try {
                          await softDeleteBuyers([buyer.id]);
                        } catch {
                          /* ignore */
                        }
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button className="inline-flex items-center gap-1 text-[11px] sm:text-xs px-2 py-1 rounded-lg bg-white ring-1 ring-neutral-300 hover:bg-neutral-50" onClick={() => onOpenDetail(buyer.id)}>
                    <span className="text-neutral-600">자세히 보기</span>
                  </button>
                </div>
                <div className="text-[12px] text-neutral-500 leading-tight">
                  <div>접수 {String((buyer as any)._recDate || buyer?.receivedDate || "-")}</div>
                  <div>{assignedLabel || "-"}</div>
                </div>
                <div className="text-sm sm:text-base text-neutral-900">
                  {canDial ? (
                    <a href={`tel:${String(phone).replace(/[^0-9+]/g, "")}`} className="hover:underline text-neutral-900">
                      {phone}
                    </a>
                  ) : (
                    <span className="text-neutral-400">{phone}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
