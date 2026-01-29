import React from "react";
import Navbar from "../components/AppNavbar";
import ListingDetailSheet from "../components/ListingDetailSheet";
import ErrorBoundary from "../components/ErrorBoundary";
import ListingCard from "../components/ListingCard";
import ListingTableView from "../components/ListingTableView";
import ListingSearchBar, { makeDefaultFilters, type ListingFilters } from "../components/ListingSearchBar";
import type { SortCriterion } from "../lib/listingFilters";
import { useSelection } from "../context/SelectionContext";
import { useActiveListings, useListings, useListingsMeta } from "../state/useListings";
import { useMatches } from "../state/useMatches";
import { useAuth } from "../context/AuthContext";
import { softDeleteListings, hardDeleteListings } from "../lib/delete";
import { filterAndSort, normalizeComplexName } from "../lib/listingFilter";
import { listUserProfiles, type UserProfile } from "../lib/users";
import { formatTimestamp } from "../lib/format";

const CHUNK_SIZE = 50;

function toBudgetLabel(value?: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const eok = n / 10000;
  if (eok >= 1) return `${eok.toFixed(1).replace(/\.0$/, "")}억`;
  return `${n.toLocaleString("ko-KR")}만원`;
}

function formatPrintPrice(row: any) {
  const typeText = String(row?.type ?? "").toLowerCase();
  const depositValue = Number(row?.deposit);
  const monthlyValue = Number(row?.monthly);
  const priceValue = Number(row?.price);
  const isWolse =
    typeText.includes("월세") || (Number.isFinite(monthlyValue) && monthlyValue > 0);
  const isJeonse = typeText.includes("전세");

  if (isWolse) {
    const dep = Number.isFinite(depositValue) && depositValue > 0 ? depositValue : undefined;
    const mon = Number.isFinite(monthlyValue) && monthlyValue > 0 ? monthlyValue : undefined;
    if (!dep && !mon) return "-";
    const depLabel = dep ? toBudgetLabel(dep) : "-";
    const monLabel = mon ? mon.toLocaleString("ko-KR") : "-";
    return `${depLabel} / ${monLabel}`;
  }

  if (isJeonse) {
    const val = Number.isFinite(depositValue) && depositValue > 0 ? depositValue : priceValue;
    return Number.isFinite(val) && val > 0 ? toBudgetLabel(val) : "-";
  }

  const sale = priceValue;
  return Number.isFinite(sale) && sale > 0 ? toBudgetLabel(sale) : "-";
}

export default function ListingsPage() {
  const rows = useActiveListings();
  const allRows = useListings();
  const { hasMore, loadMore, loading } = useListingsMeta();
  const matches = useMatches();
  const { selected, toggle: toggleSelect, isSelected, setMany } = useSelection("listings");
  const [filters, setFilters] = React.useState<ListingFilters>(() => makeDefaultFilters());
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [visibleCount, setVisibleCount] = React.useState(CHUNK_SIZE);
  const [viewMode, setViewMode] = React.useState<"cards" | "table">(() => {
    try {
      const v = localStorage.getItem("rj_listings_view");
      return v === "table" || v === "cards" ? (v as "cards" | "table") : "cards";
    } catch {
      return "cards";
    }
  });
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const items = React.useMemo(() => filterAndSort(rows as any[], filters, "listings"), [rows, filters]);
  const pagedItems = React.useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const printableRows = React.useMemo(() => {
    return (pagedItems as any[]).map((row) => {
      const complex = row?.complex ?? row?.title ?? "-";
      const dongHo = [row?.dong, row?.ho].filter(Boolean).join("-");
      const areaLabel = row?.area_py != null ? `${row.area_py}평${row?.typeSuffix ?? ""}` : "-";
      const ownerText = row?.owner ?? row?.assigneeName ?? "-";
      const receivedLabel = formatTimestamp(row.receivedAt, false);
      const printedReceived = receivedLabel ? receivedLabel.replace(/-/g, ".") : "-";
      return {
        id: row?.id,
        complex,
        dongHo: dongHo || "-",
        areaType: areaLabel || "-",
        transaction: row?.type ?? "-",
        price: formatPrintPrice(row),
        owner: ownerText,
        phone: row?.phone ?? "-",
        memo: row?.memo ?? "-",
        receivedAt: printedReceived,
        urgent: Boolean(row?.urgent),
        isOur: row?.ownershipType === "our",
      };
    });
  }, [pagedItems]);
  const pageUniverse = React.useMemo(() => filterAndSort(rows as any[], makeDefaultFilters(), "listings"), [rows]);
  const pageIdSet = React.useMemo(() => new Set((pageUniverse as any[]).map((r: any) => r.id)), [pageUniverse]);
  const selectedIds = React.useMemo(() => selected.filter((id) => pageIdSet.has(id)), [selected, pageIdSet]);
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.length;
  const visibleIds = React.useMemo(() => (pagedItems as any[]).map((r: any) => r?.id).filter(Boolean) as string[], [pagedItems]);
  const visibleIdSet = React.useMemo(() => new Set(visibleIds), [visibleIds]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));

  const areaOptions = React.useMemo(() => {
    const s = new Set<number>();
    (rows as any[]).forEach((r: any) => {
      if (typeof r.area_py === "number") s.add(r.area_py);
    });
    return Array.from(s).sort((a, b) => a - b);
  }, [rows]);

  const complexOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    (allRows as any[]).forEach((row: any) => {
      const raw = String(row?.complex ?? row?.title ?? "").trim();
      if (!raw) return;
      const key = normalizeComplexName(raw);
      if (!key) return;
      if (!map.has(key)) map.set(key, raw);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "ko"));
  }, [allRows]);

  const hasLocalMore = visibleCount < items.length;

  React.useEffect(() => setVisibleCount(CHUNK_SIZE), [filters]);

  React.useEffect(() => {
    listUserProfiles()
      .then((all) => setUsers(all.filter((u) => u.role === "owner" || u.role === "admin" || u.role === "staff")))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem("rj_listings_view", viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  const handleShowMore = React.useCallback(() => {
    setVisibleCount((prev) => {
      const next = prev + CHUNK_SIZE;
      if (next >= items.length && hasMore && !loading) loadMore();
      return next;
    });
  }, [hasMore, items.length, loadMore, loading]);

  React.useEffect(() => {
    if (!sentinelRef.current) return;
    const node = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          if (!hasLocalMore && !hasMore) return;
          if (!hasLocalMore && loading) return;
          handleShowMore();
        });
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [handleShowMore, hasLocalMore, hasMore, loading]);

  React.useEffect(() => {
    if (!hasMore || loading) return;
    loadMore();
  }, [hasMore, loading, loadMore]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const cleanup = () => document.body.classList.remove("print-mode");
    window.addEventListener("afterprint", cleanup);
    return () => window.removeEventListener("afterprint", cleanup);
  }, []);

  const handleSortCriteriaChange = React.useCallback(
    (next: SortCriterion[]) => {
      setFilters((prev) => ({ ...prev, sortCriteria: next }));
    },
    []
  );

  const handlePrint = React.useCallback(() => {
    if (typeof window === "undefined") return;
    document.body.classList.add("print-mode");
    window.print();
    setTimeout(() => document.body.classList.remove("print-mode"), 500);
  }, []);

  const { user } = useAuth();
  const role = (user as any)?.role;
  const isAdmin = role === "owner" || role === "admin";

  async function handleSoftDeleteSelected() {
    if (selectedCount === 0) return;
    const ok = window.confirm(`선택 ${selectedCount}건을 보류 처리할까요?\n(보류 후 복구 가능합니다)`);
    if (!ok) return;
    const remaining = selected.filter((id) => !selectedSet.has(id));
    await softDeleteListings(selectedIds);
    setMany(remaining);
  }

  async function handleHardDeleteSelected() {
    if (selectedCount === 0 || !isAdmin) return;
    const phrase = prompt("선택 매물을 완전 삭제하시겠습니까?\n'완전 삭제'를 입력하면 진행합니다");
    if (phrase !== "완전 삭제") return;
    const remaining = selected.filter((id) => !selectedSet.has(id));
    await hardDeleteListings(selectedIds);
    setMany(remaining);
  }

  async function handleSoftDeleteSingle(id: string) {
    const ok = window.confirm("이 매물을 보류 처리할까요?\n(나중에 복구 가능합니다)");
    if (!ok) return;
    await softDeleteListings([id]);
    setMany(selected.filter((sid) => sid !== id));
  }

  function handleToggleSelectAllVisible() {
    if (!visibleIds.length) return;
    if (allVisibleSelected) {
      const next = selected.filter((id) => !visibleIdSet.has(id));
      setMany(next);
    } else {
      const next = Array.from(new Set([...selected, ...visibleIds]));
      setMany(next);
    }
  }

  return (
    <>
      <div className="min-h-screen bg-neutral-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
            <h1 className="text-2xl font-bold">매물 목록</h1>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-500 mt-1 sm:mt-0">
              <span>선택 {selectedCount}건</span>
              <span className="hidden sm:inline">·</span>
              <span>전체 {items.length.toLocaleString()}건</span>
              <button
                type="button"
                onClick={handleToggleSelectAllVisible}
                disabled={!visibleIds.length}
                className="ml-1 px-2 py-1 rounded border border-neutral-300 text-[11px] sm:text-xs text-neutral-600 disabled:opacity-40"
              >
                {allVisibleSelected ? "선택 해제" : "전체 선택"}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2">
            <div className="inline-flex rounded-lg bg-white ring-1 ring-neutral-300 overflow-hidden shrink-0">
              <button
                type="button"
                onClick={handleSoftDeleteSelected}
                disabled={selectedCount === 0}
                className="h-7 sm:h-9 px-2 sm:px-3 text-[11px] sm:text-sm text-red-700 disabled:opacity-40"
                title="보류"
              >
                보류
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={handleHardDeleteSelected}
                  disabled={selectedCount === 0}
                  className="h-7 sm:h-9 px-2 sm:px-3 text-[11px] sm:text-sm text-white bg-red-700 disabled:opacity-40"
                  title="완전 삭제"
                >
                  완전 삭제
                </button>
              ) : null}
            </div>
              <div className="inline-flex rounded-lg bg-white ring-1 ring-neutral-300 overflow-hidden shrink-0">
                <button
                  type="button"
                  className={`h-7 sm:h-9 px-2 sm:px-3 text-[11px] sm:text-sm ${viewMode === "cards" ? "bg-neutral-900 text-white" : "text-neutral-800"}`}
                  onClick={() => setViewMode("cards")}
                  title="카드"
                >
                  카드
                </button>
                <button
                  type="button"
                  className={`h-7 sm:h-9 px-2 sm:px-3 text-[11px] sm:text-sm ${viewMode === "table" ? "bg-neutral-900 text-white" : "text-neutral-800"}`}
                  onClick={() => setViewMode("table")}
                  title="표"
                >
                  표
                </button>
              </div>
              <button
                type="button"
                onClick={handlePrint}
                className="h-7 sm:h-9 px-3 rounded-lg border border-neutral-300 bg-white text-[11px] sm:text-sm text-neutral-800"
              >
                출력
              </button>
            <button
              className="h-7 sm:h-9 px-2 sm:px-3 rounded-lg bg-neutral-900 text-white text-[11px] sm:text-sm shrink-0"
              onClick={() => setDetailId("new")}
            >
              새 매물
            </button>
          </div>
        </header>


        <ListingSearchBar
          value={filters}
          onChange={setFilters}
          placeholder="검색어, 단지/주소/면적/가격/메모"
          showArea
          areaOptions={areaOptions}
          showComplex
          complexOptions={complexOptions}
          showAssignee
          showSort
          users={users}
        />

        {viewMode === "cards" ? (
          <div id="export-board" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {pagedItems.map((r: any) => (
              <ListingCard
                key={r.id}
                row={r}
                mode="listings"
                selected={isSelected(r.id)}
                onToggleSelect={toggleSelect}
                onDetail={setDetailId}
                matchCount={matches.getCountForListing(r.id)}
                onDelete={handleSoftDeleteSingle}
              />
            ))}
          </div>
        ) : (
          <ListingTableView
            rows={pagedItems as any[]}
            onOpen={setDetailId}
            mode="listings"
            onDelete={handleSoftDeleteSingle}
            isSelected={isSelected}
            onToggleSelect={toggleSelect}
            sortCriteria={filters.sortCriteria}
            onSortChange={handleSortCriteriaChange}
          />
        )}

        {items.length === 0 ? (
          <div className="mt-4 text-sm text-neutral-500">조건에 맞는 매물이 없습니다.</div>
        ) : null}

        {hasLocalMore || hasMore ? (
          <div className="flex flex-col items-center gap-3 mt-4">
            <button
              type="button"
              onClick={handleShowMore}
              className="px-4 py-2 text-sm rounded-lg ring-1 ring-neutral-300 hover:bg-neutral-100 transition disabled:opacity-60"
              disabled={loading && !hasLocalMore}
            >
              {loading && !hasLocalMore ? "Loading..." : "더보기"}
            </button>
            <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
          </div>
        ) : null}
      </div>

      {detailId ? (
        <ErrorBoundary>
          <ListingDetailSheet
            open={Boolean(detailId)}
            listingId={detailId!}
            onClose={() => setDetailId(null)}
            actions={{ save: true, complete: detailId !== "new" }}
          />
        </ErrorBoundary>
      ) : null}
    </div>
    <div className="print-panel" aria-hidden="true">
      <table className="print-table">
        <thead>
          <tr>
            <th>접수일</th>
            <th>단지</th>
            <th>동/호</th>
            <th>평형</th>
            <th>거래</th>
            <th>가격</th>
            <th>소유자</th>
            <th>연락처</th>
            <th>메모</th>
          </tr>
        </thead>
        <tbody>
          {printableRows.map((row) => (
            <tr
              key={row.id}
              className={`print-row${row.urgent ? " print-urgent" : ""}${row.isOur ? " print-our" : ""}`}
            >
              <td>{row.receivedAt}</td>
              <td>{row.complex}</td>
              <td>{row.dongHo}</td>
              <td>{row.areaType}</td>
              <td>{row.transaction}</td>
              <td>{row.price}</td>
              <td>{row.owner}</td>
              <td>{row.phone}</td>
              <td>{row.memo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
