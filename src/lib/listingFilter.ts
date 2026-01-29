import type { ListingDoc } from "./listings";
import type { ListingFilters, SortKey } from "./listingFilters";

export function normalizeComplexName(value: unknown) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return "";
  return text.replace(/[\s\-()[\]{}]/g, "");
}

function num(v?: string) {
  if (!v) return undefined;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function normalizeStatus(status?: ListingDoc["status"]) {
  if (!status) return "진행" as const;
  const s = String(status);
  if (s.includes("완료") && !s.includes("진행")) return "완료" as const;
  if (s.includes("종료") && !s.includes("진행")) return "종료" as const;
  return status;
}

export type FilterMode = "lead" | "listings" | "completed" | "ourdeals";

type FilterOptions = {
  allowInactive?: boolean;
  showInactiveOnly?: boolean;
};

function isClosedListing(row: any) {
  if (row?.closedAt || row?.completedAt) return true;
  const status = String(row?.status ?? "").toLowerCase();
  const tokens = ["완료", "종료", "계약", "closed", "complete"];
  return tokens.some((token) => status.includes(token));
}

export function filterAndSort(
  rows: ListingDoc[] | any[],
  f: ListingFilters,
  mode: FilterMode,
  options?: FilterOptions
): any[] {
  const allowInactive = options?.allowInactive ?? false;
  const q = f.q.trim().toLowerCase();

  let list = rows.filter((row: any) => {
    const status = normalizeStatus(row.status);
    const closedStatuses = new Set(["완료", "종료"]);
    const closed = isClosedListing(row) || closedStatuses.has(String(status));
    if (mode === "lead") return true;
    if (options?.showInactiveOnly) {
      if (row?.isActive !== false) return false;
    } else if (mode === "listings" && !allowInactive && row?.isActive === false) {
      return false;
    }
    if (mode === "listings" && closed) return false;
    if (mode === "completed" && !closed) return false;
    if (mode === "ourdeals" && (!closed || !row.closedByUs)) return false;
    return true;
  });

  if (f.type !== "ALL") list = list.filter((r: any) => (r.type ?? "") === f.type);
  if (f.ownership !== "ALL") {
    list = list.filter((r: any) => {
      const ownership = (r.ownershipType ?? "our") as string;
      return ownership === f.ownership;
    });
  }
  if (f.urgentOnly) list = list.filter((r: any) => Boolean(r.urgent));
  if (f.assigneeUid) list = list.filter((r: any) => (r.assigneeUid ?? "") === f.assigneeUid);
  if (f.areaPick != null) list = list.filter((r: any) => Number(r.area_py) === Number(f.areaPick));

  if (f.complex.trim()) {
    const keyword = f.complex.trim().toLowerCase();
    list = list.filter((r: any) => {
      const candidates = [r.complex, r.title];
      return candidates.some((text) =>
        text ? String(text).toLowerCase().includes(keyword) : false
      );
    });
  }

  if (f.complexChips.length) {
    const chips = new Set(
      f.complexChips.map((c) => normalizeComplexName(c)).filter(Boolean)
    );
    list = list.filter((r: any) => {
      const complexName = normalizeComplexName(r.complex ?? r.title ?? "");
      return complexName && chips.has(complexName);
    });
  }

  if (q) {
    const tokens = q.split(/\s+/).filter(Boolean);
    list = list.filter((r: any) => {
      const parts: string[] = [];
      const push = (value: unknown) => {
        if (value == null) return;
        parts.push(String(value));
      };

      push(r.title);
      push(r.complex);
      push(r.dong);
      push(r.ho);
      push(r.type);
      push(r.owner);
      push(r.agency);
      push(r.memo);
      push(r.assigneeName);
      push(r.itemNo);
      push(r.address);
      if (r.phone) {
        const phoneStr = String(r.phone);
        push(phoneStr);
        push(phoneStr.replace(/[^0-9]/g, ""));
      }
      if (Array.isArray(r.keywords)) {
        parts.push(...r.keywords.map((k: unknown) => String(k)));
      }
      if (r.dong && r.ho) {
        const d = String(r.dong);
        const h = String(r.ho);
        parts.push(`${d}${h}`, `${d}-${h}`, `${d} ${h}`);
      }

      const haystack = parts
        .filter(Boolean)
        .map((v) => String(v).toLowerCase())
        .join(" ");

      return tokens.every((token) => {
        const t = token.toLowerCase();
        // 면적 숫자 토큰(예: 47평 / 47) 매칭
        const m = /^(\d+(?:\.\d+)?)(?:평)?$/.exec(t);
        if (m) {
          const target = Number(m[1]);
          if (Number.isFinite(target) && r.area_py != null) {
            // ±0.5평 정도 허용
            if (Math.abs(Number(r.area_py) - target) <= 0.5) return true;
          }
        }
        return haystack.includes(t);
      });
    });
  }

  const pMin = num(f.priceMin);
  const pMax = num(f.priceMax);
  const dMin = num(f.depositMin);
  const dMax = num(f.depositMax);
  const mMin = num(f.monthlyMin);
  const mMax = num(f.monthlyMax);

  if (pMin != null) list = list.filter((r: any) => r.price != null && r.price >= pMin);
  if (pMax != null) list = list.filter((r: any) => r.price != null && r.price <= pMax);
  if (dMin != null) list = list.filter((r: any) => r.deposit != null && r.deposit >= dMin);
  if (dMax != null) list = list.filter((r: any) => r.deposit != null && r.deposit <= dMax);
  if (mMin != null) list = list.filter((r: any) => r.monthly != null && r.monthly >= mMin);
  if (mMax != null) list = list.filter((r: any) => r.monthly != null && r.monthly <= mMax);

  const sortCriteria = f.sortCriteria ?? [];
  if (sortCriteria.length > 0) {
    list = [...list].sort((a: any, b: any) => {
      for (const { key, direction } of sortCriteria) {
        const value = compareSortValue(getSortValue(a, key), getSortValue(b, key));
        if (value !== 0) {
          return direction === "asc" ? value : -value;
        }
      }
      return 0;
    });
  } else {
    list = [...list].sort((a: any, b: any) => {
      const ua = a.urgent ? 1 : 0;
      const ub = b.urgent ? 1 : 0;
      if (ua !== ub) return ub - ua;
      return 0;
    });
  }

  return list;
}

const sortValueGetters: Record<SortKey, (row: any) => unknown> = {
  complex: (row) => row.complex ?? row.title ?? "",
  dongHo: (row) => {
    const dong = row.dong ?? "";
    const ho = row.ho ?? "";
    if (!dong && !ho) return "";
    return [dong, ho].filter(Boolean).join("-");
  },
  area: (row) => toNumber(row.area_py),
  type: (row) => String(row.type ?? ""),
  price: (row) => toNumber(row.price),
  deposit: (row) => toNumber(row.deposit),
  monthly: (row) => toNumber(row.monthly),
  assigneeName: (row) => String(row.assigneeName ?? row.owner ?? row.agency ?? ""),
  owner: (row) => String(row.owner ?? row.assigneeName ?? ""),
  phone: (row) => String(row.phone ?? ""),
  memo: (row) => String((row as any).memo ?? (row as any).note ?? ""),
  receivedAt: (row) => toTimestamp(row.receivedAt),
  lastCommentAt: (row) => toTimestamp(row.lastCommentAt),
  updatedAt: (row) => toTimestamp(row.updatedAt ?? row.updated ?? (row as any).updatedAt),
};

function getSortValue(row: any, key: SortKey) {
  const getter = sortValueGetters[key];
  if (!getter) return null;
  return getter(row);
}

function compareSortValue(a: unknown, b: unknown) {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "ko", { numeric: true });
}

function toNumber(value: any) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toTimestamp(value: any) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === "function") {
    const millis = value.toMillis();
    if (Number.isFinite(millis)) return millis;
  }
  if (typeof value.seconds === "number") {
    const nanos = typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
    return value.seconds * 1000 + nanos / 1e6;
  }
  const parsed = Date.parse(String(value));
  if (Number.isFinite(parsed)) return parsed;
  return null;
}
