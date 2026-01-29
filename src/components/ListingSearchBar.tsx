import React from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import type { UserProfile } from "../lib/users";
import { SORT_FIELD_OPTIONS, makeDefaultFilters, setSortSlot, toggleSortDirection } from "../lib/listingFilters";
import type { ListingFilters, ListingType, SortKey } from "../lib/listingFilters";
import { normalizeComplexName } from "../lib/listingFilter";

export { makeDefaultFilters };
export type { ListingFilters, ListingType };

type Props = {
  value: ListingFilters;
  onChange: (next: ListingFilters) => void;
  users?: UserProfile[];
  showAssignee?: boolean;
  showSort?: boolean;
  mode?: "listings" | "completed" | "ourdeals";
  placeholder?: string;
  showArea?: boolean;
  areaOptions?: number[];
  showComplex?: boolean;
  complexOptions?: string[];
  complexChipOptions?: string[];
};

export default function ListingSearchBar({
  value,
  onChange,
  users = [],
  showAssignee = false,
  showSort = false,
  mode = "listings",
  placeholder = "검색",
  showArea = false,
  areaOptions = [],
  showComplex = false,
  complexOptions = [],
  complexChipOptions = [],
}: Props) {
  function set<K extends keyof ListingFilters>(k: K, v: ListingFilters[K]) {
    onChange({ ...value, [k]: v });
  }

  const safeAreaOptions = React.useMemo(
    () => (areaOptions || []).filter((n) => Number.isFinite(n)).map((n) => Number(n)),
    [areaOptions]
  );

  const [expanded, setExpanded] = React.useState(false);
  const [complexOpen, setComplexOpen] = React.useState(false);
  const [complexQuery, setComplexQuery] = React.useState("");
  const complexRef = React.useRef<HTMLDivElement | null>(null);
  const complexListId = React.useId();

  React.useEffect(() => {
    if (!complexOpen) return;
    const onClick = (event: MouseEvent) => {
      if (!complexRef.current) return;
      if (complexRef.current.contains(event.target as Node)) return;
      setComplexOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [complexOpen]);

  React.useEffect(() => {
    if (complexOpen) return;
    setComplexQuery("");
  }, [complexOpen]);

  const filteredComplexOptions = React.useMemo(() => {
    const keyword = normalizeComplexName(complexQuery);
    if (!keyword) return complexOptions;
    return complexOptions.filter((name) => normalizeComplexName(name).includes(keyword));
  }, [complexOptions, complexQuery]);

  function toggleComplex(name: string) {
    if (value.complexChips.includes(name)) {
      set(
        "complexChips",
        value.complexChips.filter((chip) => chip !== name)
      );
    } else {
      set("complexChips", [...value.complexChips, name]);
    }
  }

  function toggleChip(name: string) {
    toggleComplex(name);
  }

  function clearComplex() {
    if (value.complexChips.length === 0) return;
    set("complexChips", []);
  }

  const complexLabel = React.useMemo(() => {
    if (value.complexChips.length === 0) return "단지명";
    const head = value.complexChips[0];
    if (value.complexChips.length === 1) return head;
    return `${head} 외 ${value.complexChips.length - 1}`;
  }, [value.complexChips]);

  const complexSelected = React.useMemo(
    () => new Set(value.complexChips),
    [value.complexChips]
  );

  const sortCriteria = value.sortCriteria ?? [];

  function handleSortSlotChange(slot: number, nextKey: string) {
    const key = (nextKey || "") as SortKey | "";
    set("sortCriteria", setSortSlot(sortCriteria, slot, key));
  }

  function handleSortDirectionToggle(slot: number) {
    set("sortCriteria", toggleSortDirection(sortCriteria, slot));
  }

  return (
    <div className="grid grid-cols-1 gap-3 mb-4">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-neutral-500" />
        <input
          type="search"
          inputMode="search"
          placeholder={placeholder}
          value={value.q}
          onChange={(e) => set("q", e.target.value)}
          className="h-8 sm:h-9 px-3 rounded-lg border border-neutral-200 bg-white placeholder:text-neutral-400 w-full text-base sm:text-sm"
        />
        <button
          className="h-8 sm:h-9 px-2 rounded-lg border border-neutral-200 bg-white text-xs sm:hidden whitespace-nowrap inline-flex items-center gap-1"
          onClick={() => setExpanded((v) => !v)}
          aria-label="필터"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden [@media(min-width:420px)]:inline">필터</span>
        </button>
      </div>

      {false && showComplex ? (
        <div className="grid gap-2 sm:flex sm:items-center sm:gap-3">
          <div className="flex-1">
            <input
              list={complexListId}
              className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-sm"
              placeholder="단지명 검색"
              value={value.complex}
              onChange={(e) => set("complex", e.target.value)}
            />
            {complexOptions.length ? (
              <datalist id={complexListId}>
                {complexOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            ) : null}
          </div>
          {complexChipOptions.length ? (
            <div className="flex flex-wrap gap-1">
              {complexChipOptions.map((chip) => {
                const active = value.complexChips.includes(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    className={`px-3 py-1 rounded-full text-xs border ${
                      active
                        ? "bg-slate-900 text-white border-slate-900"
                        : "border-neutral-300 text-neutral-700 bg-white"
                    }`}
                    onClick={() => toggleChip(chip)}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <select
          value={value.type}
          onChange={(e) => set("type", e.target.value as ListingType)}
          className="h-8 sm:h-9 px-3 rounded-lg border border-neutral-200 bg-white w-full sm:w-auto"
        >
          <option value="ALL">전체</option>
          <option value="매매">매매</option>
          <option value="전세">전세</option>
          <option value="월세">월세</option>
        </select>

        <select
          value={value.ownership}
          onChange={(e) => set("ownership", e.target.value as ListingFilters["ownership"])}
          className="h-8 sm:h-9 px-3 rounded-lg border border-neutral-200 bg-white w-full sm:w-auto"
        >
          <option value="ALL">소유 구분</option>
          <option value="our">우리 물건</option>
          <option value="partner">타사 물건</option>
        </select>

        {showArea ? (
          <select
            value={value.areaPick == null ? "" : String(value.areaPick)}
            onChange={(e) => set("areaPick", e.target.value ? Number(e.target.value) : null)}
            className="h-8 sm:h-9 px-3 rounded-lg border border-neutral-200 bg-white w-full sm:w-auto"
          >
            <option value="">면적</option>
            {safeAreaOptions.map((a) => (
              <option key={a} value={String(a)}>
                {a}평
              </option>
            ))}
          </select>
        ) : null}

        {showComplex ? (
          <div className="relative w-full sm:w-auto" ref={complexRef}>
            <button
              type="button"
              onClick={() => setComplexOpen((prev) => !prev)}
              className="h-8 sm:h-9 w-full sm:w-auto min-w-[140px] px-3 rounded-lg border border-neutral-200 bg-white text-sm text-left flex items-center justify-between gap-2"
              aria-expanded={complexOpen}
            >
              <span className="truncate">{complexLabel}</span>
              {value.complexChips.length ? (
                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                  {value.complexChips.length}
                </span>
              ) : null}
            </button>
            {complexOpen ? (
              <div className="absolute z-40 mt-2 w-full sm:w-[260px] rounded-xl border border-neutral-200 bg-white shadow-lg">
                <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100">
                  <span className="text-[11px] text-neutral-500">단지 선택</span>
                  <button
                    type="button"
                    onClick={clearComplex}
                    className="text-[11px] text-neutral-600 hover:text-neutral-900"
                  >
                    전체 해제
                  </button>
                </div>
                <div className="px-3 py-2 border-b border-neutral-100">
                  <input
                    type="search"
                    inputMode="search"
                    placeholder="단지 검색"
                    value={complexQuery}
                    onChange={(e) => setComplexQuery(e.target.value)}
                    className="h-8 w-full rounded-md border border-neutral-200 px-2 text-xs"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto px-3 py-2 space-y-1">
                  {filteredComplexOptions.length ? (
                    filteredComplexOptions.map((name) => (
                      <label key={name} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-neutral-300"
                          checked={complexSelected.has(name)}
                          onChange={() => toggleComplex(name)}
                        />
                        <span className="truncate" title={name}>
                          {name}
                        </span>
                      </label>
                    ))
                  ) : (
                    <div className="text-xs text-neutral-500">
                      {complexQuery.trim() ? "검색 결과가 없습니다." : "단지 목록이 없습니다."}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {showAssignee ? (
          <select
            value={value.assigneeUid}
            onChange={(e) => set("assigneeUid", e.target.value)}
            className="h-8 sm:h-9 px-3 rounded-lg border border-neutral-200 bg-white w-full sm:w-auto"
          >
            <option value="">담당자</option>
            {users.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.name || u.email}
              </option>
            ))}
          </select>
        ) : null}

        <label className="inline-flex items-center gap-2 h-8 sm:h-9 px-2 rounded-lg border border-neutral-200 bg-white w-full sm:w-auto">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-neutral-300"
            checked={Boolean(value.urgentOnly)}
            onChange={(e) => set("urgentOnly", e.target.checked)}
          />
          <span className="text-sm text-neutral-700">급매만</span>
        </label>

        {showSort ? (
          <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
            {[0, 1].map((slot) => {
              const descriptor = sortCriteria[slot];
              const slotDisabled = slot === 1 && !sortCriteria[0];
              return (
                <div key={slot} className="flex items-center gap-2">
                  <span className="text-[11px] text-neutral-500">{slot === 0 ? "1순위" : "2순위"}</span>
                  <select
                    value={descriptor?.key ?? ""}
                    onChange={(e) => handleSortSlotChange(slot, e.target.value)}
                    disabled={slotDisabled}
                    className="h-8 sm:h-9 px-3 rounded-lg border border-neutral-200 bg-white flex-1 min-w-[130px]"
                  >
                    <option value="">정렬 없음</option>
                    {SORT_FIELD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleSortDirectionToggle(slot)}
                    disabled={!descriptor}
                    aria-label="정렬 방향 전환"
                    className="h-8 sm:h-9 px-2 rounded-lg border border-neutral-200 bg-white text-[11px]"
                  >
                    {descriptor ? (descriptor.direction === "asc" ? "▲" : "▼") : "▲▼"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className={`${expanded ? "grid" : "hidden"} sm:flex grid grid-cols-2 gap-2 sm:gap-2 sm:items-center`}>
        <div className="flex items-center gap-1">
          <span className="text-sm text-neutral-600">매매가</span>
          <input
            placeholder="최소"
            className="h-8 sm:h-9 w-20 sm:w-24 px-2 rounded border border-neutral-300 text-base sm:text-sm"
            value={value.priceMin}
            onChange={(e) => set("priceMin", e.target.value)}
          />
          <span>~</span>
          <input
            placeholder="최대"
            className="h-8 sm:h-9 w-20 sm:w-24 px-2 rounded border border-neutral-300 text-base sm:text-sm"
            value={value.priceMax}
            onChange={(e) => set("priceMax", e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1">
          <span className="text-sm text-neutral-600">보증금</span>
          <input
            placeholder="최소"
            className="h-8 sm:h-9 w-20 sm:w-24 px-2 rounded border border-neutral-300 text-base sm:text-sm"
            value={value.depositMin}
            onChange={(e) => set("depositMin", e.target.value)}
          />
          <span>~</span>
          <input
            placeholder="최대"
            className="h-8 sm:h-9 w-20 sm:w-24 px-2 rounded border border-neutral-300 text-base sm:text-sm"
            value={value.depositMax}
            onChange={(e) => set("depositMax", e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1">
          <span className="text-sm text-neutral-600">월세</span>
          <input
            placeholder="최소"
            className="h-8 sm:h-9 w-20 sm:w-24 px-2 rounded border border-neutral-300 text-base sm:text-sm"
            value={value.monthlyMin}
            onChange={(e) => set("monthlyMin", e.target.value)}
          />
          <span>~</span>
          <input
            placeholder="최대"
            className="h-8 sm:h-9 w-20 sm:w-24 px-2 rounded border border-neutral-300 text-base sm:text-sm"
            value={value.monthlyMax}
            onChange={(e) => set("monthlyMax", e.target.value)}
          />
        </div>

        <div className="flex sm:ml-auto justify-end">
          <button
            className="h-8 sm:h-9 px-3 rounded-lg ring-1 ring-neutral-300"
            onClick={() => onChange(makeDefaultFilters())}
          >
            초기화
          </button>
        </div>
      </div>
    </div>
  );
}
