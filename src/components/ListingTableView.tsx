import React from "react";
import type { Listing } from "../types/core";
import { setSortSlot, toggleSortDirection } from "../lib/listingFilters";
import type { SortCriterion, SortKey } from "../lib/listingFilters";
import { formatTimestamp } from "../lib/format";

type Props = {
  rows: (Listing & {
    assigneeName?: string;
    phone?: string;
    ownershipType?: string;
    urgent?: boolean;
    closedByUs?: boolean;
    memo?: string;
    note?: string;
  })[];
  mode: "listings" | "completed" | "ourdeals";
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
  isSelected: (id: string) => boolean;
  onToggleSelect: (id: string) => void;
  sortCriteria?: SortCriterion[];
  onSortChange?: (criteria: SortCriterion[]) => void;
};

const COL = {
  complex: "w-15",
  dongho: "w-15",
  area: "w-9",
  type: "w-8",
  price: "w-15",
  owner: "w-10",
  phone: "w-18",
  memo: "w-70",
  receivedAt: "w-24",
};

function formatPricePair(row: any) {
  const { price, deposit, monthly, type } = row;
  const toEok = (v?: any) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "-";
    const eok = n / 10000;
    if (eok >= 1) return `${eok.toFixed(1).replace(/\.0$/, "")}억`;
    return `${n.toLocaleString("ko-KR")}만원`;
  };
  const typeText = String(type || "").toLowerCase();
  const isWolse = typeText.includes("월세") || Number(monthly) > 0;
  const isJeonse = typeText.includes("전세");

  if (isWolse) {
    const dep = Number.isFinite(Number(deposit)) && Number(deposit) > 0 ? Number(deposit) : undefined;
    const mon = Number.isFinite(Number(monthly)) && Number(monthly) > 0 ? Number(monthly) : undefined;
    if (!dep && !mon) return "-";
    return `${dep ? toEok(dep) : "-"} / ${mon ? mon.toLocaleString("ko-KR") : "-"}`;
  }

  if (isJeonse) {
    const val = Number.isFinite(Number(deposit)) && Number(deposit) > 0 ? Number(deposit) : Number(price);
    return val && val > 0 ? toEok(val) : "-";
  }

  const sale = Number(price);
  return Number.isFinite(sale) && sale > 0 ? toEok(sale) : "-";
}

export default function ListingTableView({
  rows,
  onOpen,
  onDelete,
  isSelected,
  onToggleSelect,
  sortCriteria = [],
  onSortChange,
}: Props) {
  const [filters, setFilters] = React.useState({
    complex: "",
    dongho: "",
    area: "",
    type: "",
    price: "",
    owner: "",
    phone: "",
    memo: "",
    receivedAt: "",
  });

  const processedRows = React.useMemo(() => {
    const f = filters;
    const normalizedReceivedFilter = f.receivedAt.toLowerCase().replace(/-/g, ".");
    const filtered = rows.filter((r) => {
      const hay = (s: any) => String(s ?? "").toLowerCase();
      const complexOk = hay(r.complex).includes(f.complex.toLowerCase()) || hay(r.title).includes(f.complex.toLowerCase());
      const dongHo = [r.dong, r.ho].filter(Boolean).join("-").toLowerCase();
      const dongOk = dongHo.includes(f.dongho.toLowerCase());
      const areaOk = f.area.trim() === "" || hay(r.area_py).includes(f.area.toLowerCase());
      const typeOk = hay(r.type).includes(f.type.toLowerCase());
      const priceOk = hay(formatPricePair(r)).includes(f.price.toLowerCase());
      const ownerOk = hay(r.owner).includes(f.owner.toLowerCase());
      const phoneOk = hay(r.phone).includes(f.phone.toLowerCase());
      const memoText = (r as any).memo ?? (r as any).note ?? "";
      const memoOk = f.memo.trim() === "" || hay(memoText).includes(f.memo.toLowerCase());
      const rawReceivedLabel = formatTimestamp(r.receivedAt, false);
      const replacedReceivedLabel = rawReceivedLabel ? rawReceivedLabel.replace(/-/g, ".") : "";
      const receivedOk = replacedReceivedLabel.toLowerCase().includes(normalizedReceivedFilter);
      return (
        complexOk &&
        dongOk &&
        areaOk &&
        typeOk &&
        priceOk &&
        ownerOk &&
        phoneOk &&
        memoOk &&
        receivedOk
      );
    });
    return filtered;
  }, [rows, filters]);

  const handleHeaderSort = (key: SortKey, event: React.MouseEvent<HTMLTableCellElement>) => {
    if (!onSortChange) return;
    let slot = event.shiftKey ? 1 : 0;
    if (slot === 1 && !sortCriteria.length) slot = 0;
    if (sortCriteria[slot]?.key === key) {
      onSortChange(toggleSortDirection(sortCriteria, slot));
      return;
    }
    onSortChange(setSortSlot(sortCriteria, slot, key));
  };

  const renderSortIndicator = (key: SortKey) => {
    const index = sortCriteria.findIndex((item) => item.key === key);
    if (index === -1) return null;
    const desc = sortCriteria[index];
    const arrow = desc.direction === "asc" ? "▲" : "▼";
    return (
      <span className="ml-1 text-[11px] text-neutral-500 whitespace-nowrap">
        {arrow}
        <span className="ml-0.5 text-[9px] font-medium">{index + 1}</span>
      </span>
    );
  };

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm table-wrapper">
      <table className="listing-table w-full text-[13px] text-neutral-800">
        <thead className="bg-neutral-50 text-xs text-neutral-500 sticky top-0 z-10">
          <tr className="border-b border-neutral-200">
            <th className="px-3 py-2 w-10 text-left">
              <span className="sr-only">선택</span>
            </th>
            <th
              className={`px-3 py-2 text-center cursor-pointer ${COL.receivedAt}`}
              onClick={(e) => onSortChange && handleHeaderSort("receivedAt", e)}
            >
              접수일 {renderSortIndicator("receivedAt")}
            </th>
            <th
              className={`px-3 py-2 text-left cursor-pointer ${COL.complex}`}
              onClick={(e) => onSortChange && handleHeaderSort("complex", e)}
            >
              단지 {renderSortIndicator("complex")}
            </th>
            <th
              className={`px-3 py-2 text-center cursor-pointer ${COL.dongho}`}
              onClick={(e) => onSortChange && handleHeaderSort("dongHo", e)}
            >
              동/호{renderSortIndicator("dongHo")}
            </th>
            <th
              className={`px-3 py-2 text-center cursor-pointer ${COL.area}`}
              onClick={(e) => onSortChange && handleHeaderSort("area", e)}
            >
              평형 {renderSortIndicator("area")}
            </th>
            <th
              className={`px-3 py-2 text-center cursor-pointer ${COL.type}`}
              onClick={(e) => onSortChange && handleHeaderSort("type", e)}
            >
              거래 {renderSortIndicator("type")}
            </th>
            <th
              className={`px-3 py-2 text-right cursor-pointer ${COL.price}`}
              onClick={(e) => onSortChange && handleHeaderSort("price", e)}
            >
              가격{renderSortIndicator("price")}
            </th>
            <th
              className={`px-3 py-2 text-center cursor-pointer ${COL.owner}`}
              onClick={(e) => onSortChange && handleHeaderSort("owner", e)}
            >
              소유자{renderSortIndicator("owner")}
            </th>
            <th
              className={`px-3 py-2 text-center cursor-pointer ${COL.phone}`}
              onClick={(e) => onSortChange && handleHeaderSort("phone", e)}
            >
              연락처{renderSortIndicator("phone")}
            </th>
            <th
              className={`px-3 py-2 text-left cursor-pointer ${COL.memo}`}
              onClick={(e) => onSortChange && handleHeaderSort("memo", e)}
            >
              메모 {renderSortIndicator("memo")}
            </th>
          </tr>
          <tr className="bg-neutral-50 border-b border-neutral-200 text-[11px] text-neutral-500">
            <th className="px-3 py-1" />
            <th className="px-3 py-1">
              <input
                className="w-full rounded border border-neutral-200 px-2 py-1 text-center"
                placeholder="접수일"
                value={filters.receivedAt}
                onChange={(e) => setFilters((prev) => ({ ...prev, receivedAt: e.target.value }))}
              />
            </th>
            <th className="px-3 py-1">
              <input
                className="w-full rounded border border-neutral-200 px-2 py-1"
                placeholder="단지"
                value={filters.complex}
                onChange={(e) => setFilters((prev) => ({ ...prev, complex: e.target.value }))}
              />
            </th>
            <th className="px-3 py-1">
              <input
                className="w-full rounded border border-neutral-200 px-2 py-1 text-center"
                placeholder="동/호"
                value={filters.dongho}
                onChange={(e) => setFilters((prev) => ({ ...prev, dongho: e.target.value }))}
              />
            </th>
            <th className="px-3 py-1">
              <input
                className="w-full rounded border border-neutral-200 px-2 py-1 text-center"
                placeholder="평형"
                value={filters.area}
                onChange={(e) => setFilters((prev) => ({ ...prev, area: e.target.value }))}
              />
            </th>
            <th className="px-3 py-1">
              <input
                className="w-full rounded border border-neutral-200 px-2 py-1 text-center"
                placeholder="거래"
                value={filters.type}
                onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
              />
            </th>
            <th className="px-3 py-1">
              <input
                className="w-full rounded border border-neutral-200 px-2 py-1 text-right"
                placeholder="가격/보증금"
                value={filters.price}
                onChange={(e) => setFilters((prev) => ({ ...prev, price: e.target.value }))}
              />
            </th>
            <th className="px-3 py-1">
              <input
                className="w-full rounded border border-neutral-200 px-2 py-1 text-center"
                placeholder="소유자"
                value={filters.owner}
                onChange={(e) => setFilters((prev) => ({ ...prev, owner: e.target.value }))}
              />
            </th>
            <th className="px-3 py-1">
              <input
                className="w-full rounded border border-neutral-200 px-2 py-1 text-center"
                placeholder="연락처"
                value={filters.phone}
                onChange={(e) => setFilters((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </th>
            <th className="px-3 py-1">
              <input
                className="w-full rounded border border-neutral-200 px-2 py-1"
                placeholder="메모"
                value={filters.memo}
                onChange={(e) => setFilters((prev) => ({ ...prev, memo: e.target.value }))}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {processedRows.map((row) => {
            const rowId =
              row.id ||
              (row as any).itemNo ||
              [row.complex, row.dong, row.ho].filter(Boolean).join("-") ||
              row.title ||
              Math.random().toString(36).slice(2, 8);
            const selected = isSelected(rowId);
            const isOur = (row as any).ownershipType === "our" || (row as any).isOurDeal === true;
            const dongHo = [row.dong, row.ho].filter(Boolean).join("-") || "-";
            const rawReceived = formatTimestamp(row.receivedAt, false);
            const displayReceived = rawReceived ? rawReceived.replace(/-/g, ".") : "-";
            return (
              <tr
                key={rowId}
                className={`border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer ${
                  row.urgent ? "outline outline-2 outline-red-500" : ""
                } ${isOur ? "bg-emerald-50" : ""} ${isOur && row.urgent ? "outline-offset-1" : ""}`}
                onClick={() => onOpen(rowId)}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => onToggleSelect(rowId)}
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                </td>
                <td className={`px-3 py-2 text-center ${COL.receivedAt}`}>
                  <div className="whitespace-normal break-words text-sm">{displayReceived}</div>
                </td>
                <td className={`px-3 py-2 ${COL.complex}`}>
                  <div className="font-semibold text-neutral-900 truncate">{row.complex || row.title || "-"}</div>
                </td>
                <td className={`px-3 py-2 text-center ${COL.dongho}`}>{dongHo !== "-" ? dongHo : ""}</td>
            <td className={`px-3 py-2 text-center ${COL.area}`}>
              {row.area_py != null ? `${row.area_py}평${row.typeSuffix ?? ""}` : "-"}
            </td>
            <td className={`px-3 py-2 text-center ${COL.type}`}>{row.type || "-"}</td>
                <td className={`px-3 py-2 text-right ${COL.price}`}>
                  <div className="font-semibold text-neutral-900 whitespace-normal break-words leading-relaxed">{formatPricePair(row)}</div>
                </td>
                <td className={`px-3 py-2 text-center ${COL.owner}`}>
                  <div className="truncate">{row.owner || "-"}</div>
                </td>
                <td className={`px-3 py-2 text-center ${COL.phone}`}>
                  {row.phone ? (
                    <a
                      href={`tel:${String(row.phone).replace(/[^0-9+]/g, "")}`}
                      className="text-sky-700 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.phone}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td className={`px-3 py-2 text-left align-top ${COL.memo}`}>
                  <div className="whitespace-pre-line break-all leading-relaxed">{(row as any).memo || (row as any).note || "-"}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
