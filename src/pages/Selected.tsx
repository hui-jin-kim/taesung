import React from "react";
import { Link, useLocation } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";

import Navbar from "../components/AppNavbar";
import { useSelectionSummary } from "../context/SelectionContext";
import { useListings } from "../state/useListings";
import { formatKRW, formatAreaPy, mergeAreaSuffix } from "../lib/format";
import type { Listing } from "../types/core";
import { useBuyerMatchMemory, rememberBuyerMatches } from "../state/useBuyerMatchMemory";
import { consumeMatchBuffer, clearMatchBuffer } from "../lib/matchBuffer";
import { db } from "../lib/firebase";

type SortMode = "DEFAULT" | "TYPE_AREA";

const typeRank = (value?: Listing["type"]) => {
  if (!value) return 99;
  const initial = value[0];
  if (initial === "매") return 0;
  if (initial === "전") return 1;
  if (initial === "월") return 2;
  return 99;
};

function priceLineStrict(row: Listing) {
  const type = String(row.type || "");
  if (type === "매매") {
    return row.price != null ? `매매가 ${formatKRW(row.price)}` : "-";
  }
  if (type === "전세") {
    return row.deposit != null ? `보증금 ${formatKRW(row.deposit)}` : "-";
  }
  if (type === "월세") {
    const deposit = row.deposit != null ? `보증금 ${formatKRW(row.deposit)}` : "";
    const monthly = row.monthly != null ? `월세 ${formatKRW(row.monthly)}` : "";
    const joined = [deposit, monthly].filter(Boolean).join(" / ");
    return joined || "-";
  }
  if (row.price != null) return `매매가 ${formatKRW(row.price)}`;
  const deposit = row.deposit != null ? `보증금 ${formatKRW(row.deposit)}` : "";
  const monthly = row.monthly != null ? `월세 ${formatKRW(row.monthly)}` : "";
  return [deposit, monthly].filter(Boolean).join(" / ") || "-";
}

function titleFor(row: Listing, showHo: boolean) {
  const base = row.complex ?? row.title;
  const dong = row.dong || "";
  const ho = showHo ? row.ho || "" : "";
  let tail = "";
  if (dong && ho) tail = `${dong}-${ho}`;
  else if (dong) tail = dong;
  else if (ho) tail = ho;
  return [base, tail].filter(Boolean).join(" ");
}

export default function Selected() {
  const location = useLocation();
  const { scopes, selected, setScope, clearScope } = useSelectionSummary();
  const rows = useListings();
  const matchMemory = useBuyerMatchMemory();
  const [sortMode, setSortMode] = React.useState<SortMode>("TYPE_AREA");
  const [showHo, setShowHo] = React.useState(true);
  const [viewerMemoMode, setViewerMemoMode] = React.useState<"visible" | "hidden">("visible");
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [remoteRows, setRemoteRows] = React.useState<Record<string, Listing>>({});

  const listingIds = React.useMemo(() => scopes?.listings ?? selected, [scopes, selected]);

  const buyerContextId = React.useMemo(() => {
    const stateBuyer = (location.state as any)?.fromBuyerId;
    const params = new URLSearchParams(location.search || "");
    return stateBuyer || params.get("fromBuyer") || undefined;
  }, [location.state, location.search]);

  React.useEffect(() => {
    if (!buyerContextId) return;
    const buffered = consumeMatchBuffer(buyerContextId);
    if (buffered && buffered.length > 0) {
      setScope("listings", buffered);
      return;
    }
    const saved = matchMemory[buyerContextId];
    if (!saved || saved.ids.length === 0) return;
    const current = scopes?.listings ?? [];
    const same = current.length === saved.ids.length && current.every((id, idx) => id === saved.ids[idx]);
    if (same) return;
    setScope("listings", saved.ids);
  }, [buyerContextId, matchMemory, scopes, setScope]);

  React.useEffect(() => {
    if (!buyerContextId) return;
    if (!listingIds || listingIds.length === 0) return;
    rememberBuyerMatches(buyerContextId, listingIds);
  }, [buyerContextId, listingIds]);

  React.useEffect(() => {
    const knownIds = new Set(rows.map((r) => r.id));
    const missingIds = listingIds.filter((id) => !knownIds.has(id) && !remoteRows[id]);
    if (missingIds.length === 0) return;

    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        missingIds.map(async (id) => {
          try {
            const snap = await getDoc(doc(db, "listings", id));
            if (!snap.exists()) return null;
            return { ...(snap.data() as Listing), id: snap.id } as Listing;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      setRemoteRows((prev) => {
        const next = { ...prev };
        results.forEach((row) => {
          if (row) next[row.id] = row;
        });
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [listingIds, rows, remoteRows]);

  const items = React.useMemo(() => {
    const base = rows.filter((r) => listingIds.includes(r.id));
    const existingIds = new Set(base.map((r) => r.id));
    const hydrated = listingIds
      .filter((id) => !existingIds.has(id) && remoteRows[id])
      .map((id) => remoteRows[id] as Listing);
    let list = [...base, ...hydrated];
    if (sortMode === "TYPE_AREA") {
      list = [...list].sort((a, b) => {
        const ta = typeRank(a.type);
        const tb = typeRank(b.type);
        if (ta !== tb) return ta - tb;
        const aa = a.area_py ?? Number.POSITIVE_INFINITY;
        const bb = b.area_py ?? Number.POSITIVE_INFINITY;
        return aa - bb;
      });
    }
    return list;
  }, [rows, listingIds, sortMode, remoteRows]);

  React.useEffect(() => {
    if (items.length === 0) {
      setPreviewOpen(false);
    }
  }, [items.length]);

  const handleClearSelection = React.useCallback(() => {
    clearScope("listings");
    if (buyerContextId) {
      clearMatchBuffer(buyerContextId);
    }
    setPreviewOpen(false);
  }, [buyerContextId, clearScope]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-2xl font-bold">선택 매물</h1>

        <div className="mt-4 flex flex-wrap gap-2 text-sm items-center sm:gap-3">
          <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:gap-3 grow">
            <label className="h-9 px-3 rounded-lg border border-neutral-200 bg-white inline-flex items-center gap-2 basis-[calc(50%-6px)] sm:basis-auto">
              <input type="checkbox" checked={showHo} onChange={(e) => setShowHo(e.target.checked)} />
              호 표시
            </label>
            <label className="h-9 px-3 rounded-lg border border-neutral-200 bg-white inline-flex items-center gap-2 basis-[calc(50%-6px)] sm:basis-auto">
              <input
                type="checkbox"
                checked={viewerMemoMode === "visible"}
                onChange={(e) => setViewerMemoMode(e.target.checked ? "visible" : "hidden")}
              />
              노출 메모(뷰어)
            </label>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="h-9 px-2 rounded-lg border border-neutral-200 bg-white text-sm basis-[calc(50%-6px)] sm:basis-auto"
            >
              <option value="DEFAULT">정렬: 기본</option>
              <option value="TYPE_AREA">정렬: 구분·평형</option>
            </select>
            <Link
              to="/listings"
              className="h-9 px-3 rounded-lg border border-neutral-200 bg-white flex items-center justify-center basis-[calc(50%-6px)] sm:basis-auto"
            >
              목록으로
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 justify-start w-full sm:w-auto sm:justify-end sm:flex-nowrap sm:gap-3">
            <button
              type="button"
              className="flex-1 sm:flex-none h-9 px-3 rounded-lg border border-neutral-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed basis-[calc(50%-6px)] sm:basis-auto"
              disabled={items.length === 0}
              onClick={() => setPreviewOpen(true)}
            >
              요약 자세히 보기
            </button>
            <button
              type="button"
              className="flex-1 sm:flex-none h-9 px-3 rounded-lg border border-neutral-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed basis-[calc(50%-6px)] sm:basis-auto"
              disabled={items.length === 0}
              onClick={handleClearSelection}
            >
              선택 초기화
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-neutral-500 mt-6">선택된 매물이 없습니다.</div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((row) => {
                const metaParts: string[] = [];
                const areaDisplay = formatAreaPy(row.area_py, mergeAreaSuffix(row.areaSuffix, (row as any).typeSuffix));
                if (areaDisplay !== "-") metaParts.push(areaDisplay);
                if (row.floor) metaParts.push(`${row.floor}`);
                if (row.direction) metaParts.push(row.direction);
                const trimmedMemo = row.mobileMemo?.trim();
                const memoContent = viewerMemoMode === "visible" ? (trimmedMemo ?? "") : null;
                return (
                  <div key={row.id} className="relative p-4 rounded-xl ring-1 ring-neutral-200 bg-white">
                    <span className="absolute top-2 right-2 bg-neutral-800 text-white text-[11px] px-2 py-0.5 rounded-full">
                      {row.type ?? "-"}
                    </span>
                    <div className="text-lg font-bold truncate pr-8" title={titleFor(row, showHo)}>
                      {titleFor(row, showHo)}
                    </div>
                    <div className="mt-1 text-sm text-neutral-600">{metaParts.join(" · ") || "-"}</div>
                    <div className="mt-1 font-semibold">{priceLineStrict(row)}</div>
                    {viewerMemoMode === "visible" ? (
                      <div className="mt-3 rounded-2xl bg-neutral-50 p-3 text-sm text-neutral-700 whitespace-pre-line break-words">
                        {memoContent ? memoContent : "노출 메모 없음"}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {previewOpen && items.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-6 py-4">
              <div>
                <div className="text-lg font-semibold">요약 보기</div>
              </div>
              <button type="button" className="h-9 px-3 rounded-lg border border-neutral-200 bg-white" onClick={() => setPreviewOpen(false)}>
                닫기
              </button>
            </div>

            <div className="px-6 pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {items.map((row) => {
                  const metaParts: string[] = [];
                  const areaDisplay = formatAreaPy(row.area_py, mergeAreaSuffix(row.areaSuffix, (row as any).typeSuffix));
                  if (areaDisplay !== "-") metaParts.push(areaDisplay);
                  if (row.floor != null) metaParts.push(`${row.floor}층`);
                  if (row.direction) metaParts.push(row.direction);
                  const trimmedMemo = row.mobileMemo?.trim();
                  const memoContent = viewerMemoMode === "visible" ? (trimmedMemo ?? "") : null;

                  return (
                    <div key={row.id} className="relative p-5 rounded-2xl ring-1 ring-neutral-200 bg-white">
                      <span className="absolute top-3 right-3 bg-neutral-800 text-white text-[11px] px-2 py-0.5 rounded-full">{row.type ?? "-"}</span>
                      <div className="text-lg font-bold break-words pr-10" title={titleFor(row, showHo)}>
                        {titleFor(row, showHo)}
                      </div>
                      <div className="mt-1 text-sm text-neutral-600">{metaParts.join(" · ") || "-"}</div>
                      <div className="mt-2 font-semibold">{priceLineStrict(row) || "-"}</div>
                      {viewerMemoMode === "visible" && (
                        <div className="mt-3 rounded-2xl bg-neutral-50 p-3 text-sm text-neutral-700 min-h-[72px] whitespace-pre-line break-words">
                          {memoContent ? memoContent : "노출 메모 없음"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
