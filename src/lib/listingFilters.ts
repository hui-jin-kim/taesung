export type SortDirection = "asc" | "desc";

export type SortKey =
  | "complex"
  | "dongHo"
  | "area"
  | "type"
  | "price"
  | "deposit"
  | "monthly"
  | "assigneeName"
  | "owner"
  | "phone"
  | "memo"
  | "receivedAt"
  | "lastCommentAt"
  | "updatedAt";

export type SortCriterion = {
  key: SortKey;
  direction: SortDirection;
};

export const SORT_FIELD_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "complex", label: "단지명" },
  { value: "dongHo", label: "동/호" },
  { value: "area", label: "평형" },
  { value: "type", label: "거래" },
  { value: "price", label: "가격" },
  { value: "deposit", label: "보증금" },
  { value: "monthly", label: "월세" },
  { value: "assigneeName", label: "담당자" },
  { value: "owner", label: "소유자" },
  { value: "phone", label: "연락처" },
  { value: "memo", label: "메모" },
  { value: "receivedAt", label: "접수일" },
  { value: "lastCommentAt", label: "댓글" },
  { value: "updatedAt", label: "수정일" },
];

export type ListingType = "ALL" | "毵るГ" | "?勳劯" | "?旍劯";

export type ListingFilters = {
  q: string;
  type: ListingType;
  areaPick: number | null;
  assigneeUid: string;
  ownership: "ALL" | "our" | "partner";
  complex: string;
  complexChips: string[];
  sortCriteria: SortCriterion[];
  priceMin: string;
  priceMax: string;
  depositMin: string;
  depositMax: string;
  monthlyMin: string;
  monthlyMax: string;
  urgentOnly?: boolean;
};

export function makeDefaultFilters(): ListingFilters {
  return {
    q: "",
    type: "ALL",
    areaPick: null,
    assigneeUid: "",
    ownership: "ALL",
    complex: "",
    complexChips: [],
    sortCriteria: [],
    priceMin: "",
    priceMax: "",
    depositMin: "",
    depositMax: "",
    monthlyMin: "",
    monthlyMax: "",
    urgentOnly: false,
  };
}

export function setSortSlot(criteria: SortCriterion[], slot: number, key: SortKey | ""): SortCriterion[] {
  const current = [...(criteria ?? [])].filter((c) => c.key !== key);
  if (!key) {
    if (slot < current.length) {
      current.splice(slot, 1);
    }
    return current.slice(0, 2);
  }
  if (slot === 1 && current.length === 0) {
    slot = 0;
  }
  const direction =
    (criteria ?? []).find((c) => c.key === key)?.direction ?? (current[slot]?.direction ?? "asc");
  const descriptor: SortCriterion = { key, direction };
  if (slot === 0) {
    const prevPrimary = current[0];
    current[0] = descriptor;
    if (prevPrimary && prevPrimary.key !== key) {
      current[1] = prevPrimary;
    }
  } else {
    if (!current[0]) {
      current[0] = descriptor;
    } else {
      current[1] = descriptor;
    }
  }
  return current.slice(0, 2);
}

export function toggleSortDirection(criteria: SortCriterion[], slot: number): SortCriterion[] {
  if (!criteria?.[slot]) return criteria ?? [];
  const next = [...criteria!];
  const current = next[slot];
  next[slot] = { ...current, direction: current.direction === "asc" ? "desc" : "asc" };
  return next;
}
