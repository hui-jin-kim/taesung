import React from "react";
import Navbar from "../components/AppNavbar";
import ListingDetailSheet from "../components/ListingDetailSheet";
import ErrorBoundary from "../components/ErrorBoundary";
import ListingCard from "../components/ListingCard";
import ListingTableView from "../components/ListingTableView";
import ListingSearchBar, { makeDefaultFilters, type ListingFilters } from "../components/ListingSearchBar";
import type { SortCriterion } from "../lib/listingFilters";
import { filterAndSort } from "../lib/listingFilter";
import { listUserProfiles, type UserProfile } from "../lib/users";
import { useListings, useListingsMeta } from "../state/useListings";
import { useMatches } from "../state/useMatches";
import { useSelection } from "../context/SelectionContext";
import { useAuth } from "../context/AuthContext";
import { softDeleteListings, hardDeleteListings } from "../lib/delete";
import type { Listing } from "../types/core";

const CHUNK_SIZE = 50;

export default function CompletedListings() {
  const rows = useListings();
  const { hasMore, loadMore, loading } = useListingsMeta();
  const matches = useMatches();
  const { selected, toggle: toggleSelect, setMany, isSelected } = useSelection("completed");
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<ListingFilters>(() => makeDefaultFilters());
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = React.useState(CHUNK_SIZE);
  const [viewMode, setViewMode] = React.useState<"cards" | "table">(() => {
    try {
      const stored = localStorage.getItem("rj_completed_view");
      return stored === "table" || stored === "cards" ? (stored as "cards" | "table") : "cards";
    } catch {
      return "cards";
    }
  });

  const items = React.useMemo(() => filterAndSort(rows as any[], filters, "completed") as Listing[], [rows, filters]);
  const pagedItems = React.useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const pageUniverse = React.useMemo(() => filterAndSort(rows as any[], makeDefaultFilters(), "completed") as Listing[], [rows]);
  const pageIdSet = React.useMemo(() => new Set(pageUniverse.map((r: any) => r.id)), [pageUniverse]);
  const selectedIds = React.useMemo(() => selected.filter((id) => pageIdSet.has(id)), [selected, pageIdSet]);
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.length;
  const visibleIds = React.useMemo(() => (pagedItems as any[]).map((r: any) => r?.id).filter(Boolean) as string[], [pagedItems]);
  const visibleIdSet = React.useMemo(() => new Set(visibleIds), [visibleIds]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));

  const areaOptions = React.useMemo(() => {
    const bucket = new Set<number>();
    (rows as any[]).forEach((row: any) => {
      if (typeof row?.area_py === "number") bucket.add(row.area_py);
    });
    return Array.from(bucket).sort((a, b) => a - b);
  }, [rows]);

  const hasLocalMore = visibleCount < items.length;

  React.useEffect(() => setVisibleCount(CHUNK_SIZE), [filters]);

  React.useEffect(() => {
    listUserProfiles()
      .then((all) => setUsers(all.filter((u) => u.role === "owner" || u.role === "admin" || u.role === "staff")))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem("rj_completed_view", viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  React.useEffect(() => {
    if (!hasMore || loading) return;
    loadMore();
  }, [hasMore, loading, loadMore]);

  const handleSortCriteriaChange = React.useCallback(
    (next: SortCriterion[]) => {
      setFilters((prev) => ({ ...prev, sortCriteria: next }));
    },
    []
  );

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

  const { user } = useAuth();
  const role = (user as any)?.role;
  const isAdmin = role === "owner" || role === "admin";

  async function handleSoftDeleteSelected() {
    if (selectedCount === 0) return;
    const ok = window.confirm(`선택 ${selectedCount}건을 보관 처리할까요?\n(보관 후 복구 가능)`);
    if (!ok) return;
    const remaining = selected.filter((id) => !selectedSet.has(id));
    await softDeleteListings(selectedIds);
    setMany(remaining);
  }

  async function handleHardDeleteSelected() {
    if (selectedCount === 0 || !isAdmin) return;
    const phrase = prompt("선택 매물을 완전 삭제합니다.\n'완전삭제'를 입력하면 진행합니다.");
    if (phrase !== "완전삭제") return;
    const remaining = selected.filter((id) => !selectedSet.has(id));
    await hardDeleteListings(selectedIds);
    setMany(remaining);
  }

  async function handleSoftDeleteSingle(id: string) {
    const ok = window.confirm("이 매물을 보관 처리할까요?\n(나중에 복구 가능합니다)");
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
    <div className="min-h-screen bg-neutral-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
            <h1 className="text-2xl font-bold">완료 매물</h1>
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
                title="선택 보관"
              >
                보관
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={handleHardDeleteSelected}
                  disabled={selectedCount === 0}
                  className="h-7 sm:h-9 px-2 sm:px-3 text-[11px] sm:text-sm text-white bg-red-700 disabled:opacity-40"
                  title="선택 완전삭제"
                >
                  완전삭제
                </button>
              ) : null}
            </div>
            <div className="inline-flex rounded-lg bg-white ring-1 ring-neutral-300 overflow-hidden shrink-0">
              <button
                type="button"
                className={`h-7 sm:h-9 px-2 sm:px-3 text-[11px] sm:text-sm ${
                  viewMode === "cards" ? "bg-neutral-900 text-white" : "text-neutral-800"
                }`}
                onClick={() => setViewMode("cards")}
                title="카드 보기"
              >
                카드
              </button>
              <button
                type="button"
                className={`h-7 sm:h-9 px-2 sm:px-3 text-[11px] sm:text-sm ${
                  viewMode === "table" ? "bg-neutral-900 text-white" : "text-neutral-800"
                }`}
                onClick={() => setViewMode("table")}
                title="엑셀 보기"
              >
                엑셀
              </button>
            </div>
          </div>
        </header>

        <ListingSearchBar
          value={filters}
          onChange={setFilters}
          placeholder="검색어, 단지/주소/면적/가격/메모"
          showArea
          areaOptions={areaOptions}
          showAssignee
          showSort
          mode="completed"
          users={users}
        />

        {items.length === 0 ? (
          <div className="text-neutral-500">완료된 매물이 없습니다.</div>
        ) : viewMode === "cards" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {pagedItems.map((row: any) => (
              <ListingCard
                key={row.id}
                row={row}
                mode="completed"
                onDetail={setDetailId}
                selected={selectedSet.has(row.id)}
                onToggleSelect={toggleSelect}
                onDelete={handleSoftDeleteSingle}
              />
            ))}
          </div>
          ) : (
            <ListingTableView
              rows={pagedItems as any[]}
              onOpen={setDetailId}
              mode="completed"
              onDelete={handleSoftDeleteSingle}
              isSelected={(id) => selectedSet.has(id)}
              onToggleSelect={toggleSelect}
              sortCriteria={filters.sortCriteria}
              onSortChange={handleSortCriteriaChange}
            />
          )}

        {hasLocalMore || hasMore ? (
          <div className="flex flex-col items-center gap-3 mt-4">
            <button
              type="button"
              onClick={handleShowMore}
              className="px-4 py-2 text-sm rounded-lg ring-1 ring-neutral-300 hover:bg-neutral-100 transition disabled:opacity-60"
              disabled={loading && !hasLocalMore}
            >
              {loading && !hasLocalMore ? "Loading..." : "더 보기"}
            </button>
            <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
          </div>
        ) : null}
      </div>

      {detailId ? (
        <ErrorBoundary>
          <ListingDetailSheet open={Boolean(detailId)} listingId={detailId!} onClose={() => setDetailId(null)} actions={{ save: true, reopen: true }} />
        </ErrorBoundary>
      ) : null}
    </div>
  );
}
