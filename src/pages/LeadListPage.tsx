import React from "react";
import Navbar from "../components/AppNavbar";
import ListingDetailSheet from "../components/ListingDetailSheet";
import ErrorBoundary from "../components/ErrorBoundary";
import ListingCard from "../components/ListingCard";
import LeadListTable from "../components/LeadListTable";
import ListingSearchBar, { makeDefaultFilters, type ListingFilters } from "../components/ListingSearchBar";
import { useSelection } from "../context/SelectionContext";
import { useListings, useListingsMeta, updateListing } from "../state/useListings";
import { useMatches } from "../state/useMatches";
import { filterAndSort } from "../lib/listingFilter";
import { listUserProfiles, type UserProfile } from "../lib/users";
import { createComment } from "../lib/comments";
import { useAuth } from "../context/AuthContext";
import type { Listing } from "../types/core";

const CHUNK_SIZE = 50;

export default function LeadListPage() {
  const rows = useListings();
  const { hasMore, loadMore, loading } = useListingsMeta();
  const matches = useMatches();
  const { selected, toggle: toggleSelect, isSelected, setMany } = useSelection("lead-list");
  const [filters, setFilters] = React.useState<ListingFilters>(() => makeDefaultFilters());
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [visibleCount, setVisibleCount] = React.useState(CHUNK_SIZE);
  const [viewMode, setViewMode] = React.useState<"cards" | "table">(() => {
    try {
      const v = localStorage.getItem("rj_lead_view");
      return v === "table" || v === "cards" ? (v as "cards" | "table") : "cards";
    } catch {
      return "cards";
    }
  });
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();

  const items = React.useMemo(
    () =>
      filterAndSort(rows as any[], filters, "listings", {
        allowInactive: true,
        showInactiveOnly: true,
      }),
    [rows, filters]
  );
  const pagedItems = React.useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const pageUniverse = React.useMemo(
    () =>
      filterAndSort(rows as any[], makeDefaultFilters(), "listings", {
        allowInactive: true,
        showInactiveOnly: true,
      }),
    [rows]
  );
  const pageIdSet = React.useMemo(() => new Set((pageUniverse as any[]).map((r: any) => r.id)), [pageUniverse]);
  const selectedIds = React.useMemo(() => selected.filter((id) => pageIdSet.has(id)), [selected, pageIdSet]);
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.length;
  const visibleIds = React.useMemo(() => (pagedItems as any[]).map((r: any) => r?.id).filter(Boolean) as string[], [pagedItems]);
  const visibleIdSet = React.useMemo(() => new Set(visibleIds), [visibleIds]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const hasLocalMore = visibleCount < items.length;

  React.useEffect(() => setVisibleCount(CHUNK_SIZE), [filters]);

  React.useEffect(() => {
    listUserProfiles()
      .then((all) => setUsers(all.filter((u) => u.role === "owner" || u.role === "admin" || u.role === "staff")))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem("rj_lead_view", viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  React.useEffect(() => {
    if (!hasMore || loading) return;
    loadMore();
  }, [hasMore, loading, loadMore]);

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

  const areaOptions = React.useMemo(() => {
    const s = new Set<number>();
    (rows as any[]).forEach((r: any) => {
      if (typeof r.area_py === "number") s.add(r.area_py);
    });
    return Array.from(s).sort((a, b) => a - b);
  }, [rows]);

  const handleTypeChange = React.useCallback((id: string, type?: Listing["type"]) => {
    return updateListing(id, { type });
  }, []);

  const handlePriceSave = React.useCallback(
    (id: string, patch: Partial<Pick<Listing, "price" | "deposit" | "monthly">>) => {
      return updateListing(id, patch);
    },
    []
  );

  const handleCommentSubmit = React.useCallback(
    async (id: string, text: string) => {
      if (!user) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      const authorName =
        (user as any).name ||
        (user as any).displayName ||
        user.email ||
        user.uid;
      await createComment("listing", id, trimmed);
      await updateListing(id, {
        lastCommentText: trimmed,
        lastCommentAt: Date.now(),
        lastCommentAuthor: authorName,
      });
    },
    [user]
  );

  async function handleToggleActive(id: string, active: boolean) {
    const action = active ? "활성화" : "비활성화";
    if (!confirm(`${action}하시겠습니까?\n(변경하면 상태가 즉시 반영됩니다)`)) return;
    await updateListing(id, { isActive: active });
  }

  function handleToggleSelectAll() {
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
    <ErrorBoundary>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
            <h1 className="text-2xl font-bold">명단</h1>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-500 mt-1 sm:mt-0">
              <span>전체 {items.length}건 · 현재 {selectedCount}건 선택</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg bg-white ring-1 ring-neutral-300 overflow-hidden shrink-0">
              <button
                type="button"
                className={`h-7 sm:h-9 px-2 sm:px-3 text-[11px] sm:text-sm ${
                  viewMode === "cards" ? "bg-neutral-900 text-white" : "text-neutral-800"
                }`}
                onClick={() => setViewMode("cards")}
              >
                카드
              </button>
              <button
                type="button"
                className={`h-7 sm:h-9 px-2 sm:px-3 text-[11px] sm:text-sm ${
                  viewMode === "table" ? "bg-neutral-900 text-white" : "text-neutral-800"
                }`}
                onClick={() => setViewMode("table")}
              >
                엑셀
              </button>
            </div>
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="text-xs px-2 py-1 rounded-lg ring-1 ring-neutral-200"
            >
              {allVisibleSelected ? "선택 해제" : "현재 목록 선택"}
            </button>
          </div>
        </header>

        <ListingSearchBar
          value={filters}
          onChange={setFilters}
          placeholder="검색어 / 단지명 / 메모"
          showArea
          areaOptions={areaOptions}
          showAssignee
          showSort
          users={users}
        />

        <section className="mt-4">
          {viewMode === "cards" ? (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {pagedItems.map((row: any) => (
                <ListingCard
                  key={row.id}
                  row={row}
                  mode="listings"
                  onDetail={setDetailId}
                  selected={isSelected(row.id)}
                  onToggleSelect={toggleSelect}
                  matchCount={matches.getCountForListing(row.id)}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          ) : (
            <LeadListTable
              rows={pagedItems as any[]}
              isSelected={isSelected}
              onToggleSelect={toggleSelect}
              onOpen={setDetailId}
              onCommentSubmit={handleCommentSubmit}
              onTypeChange={handleTypeChange}
              onPriceSave={handlePriceSave}
              onToggleActive={handleToggleActive}
            />
          )}
          <div ref={sentinelRef} className="h-10" />
        </section>
      </main>

      <ListingDetailSheet open={detailId != null} listingId={detailId || "new"} onClose={() => setDetailId(null)} />
    </ErrorBoundary>
  );
}
