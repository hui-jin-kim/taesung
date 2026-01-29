import React from "react";
import type { Listing } from "../types/core";
import { formatTimestamp } from "../lib/format";

type PricePatch = Partial<Pick<Listing, "price" | "deposit" | "monthly">>;

type Props = {
  rows: (Listing & { memo?: string })[];
  isSelected: (id: string) => boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onCommentSubmit?: (id: string, comment: string) => Promise<void>;
  onTypeChange?: (id: string, type?: Listing["type"]) => Promise<void>;
  onPriceSave?: (id: string, patch: PricePatch) => Promise<void>;
  onToggleActive?: (id: string, active: boolean) => void;
};

const formatPrice = (row: Listing) => {
  const toEok = (value: number | undefined) => {
    if (!value || !Number.isFinite(value) || value <= 0) return "-";
    const eok = value / 10000;
    if (eok >= 1) return `${eok.toFixed(1).replace(/\.0$/, "")}억`;
    return `${value.toLocaleString("ko-KR")}만원`;
  };

  const deposit = Number.isFinite(Number(row.deposit)) ? Number(row.deposit) : undefined;
  const monthly = Number.isFinite(Number(row.monthly)) ? Number(row.monthly) : undefined;
  const sale = Number.isFinite(Number(row.price)) ? Number(row.price) : undefined;
  const typeText = String(row.type || "").toLowerCase();
  const isWolse = typeText.includes("월세") || (monthly ?? 0) > 0;
  const isJeonse = typeText.includes("전세");

  if (isWolse) {
    if (!deposit && !monthly) return "-";
    return `${deposit ? toEok(deposit) : "-"} / ${monthly ? monthly.toLocaleString("ko-KR") : "-"}`;
  }
  if (isJeonse) {
    const target = deposit ?? sale ?? 0;
    return target ? toEok(target) : "-";
  }
  return sale ? toEok(sale) : "-";
};

const formatArea = (row: Listing) => {
  const area = row.area_py;
  if (typeof area !== "number" || Number.isNaN(area)) return "-";
  const suffix = row.areaSuffix ? ` ${row.areaSuffix}` : "";
  const typeSuffix = row.typeSuffix ? ` ${row.typeSuffix}` : "";
  return `${area}평${suffix}${typeSuffix}`;
};

const formatDongHo = (row: Listing) => {
  const parts = [row.dong, row.ho].filter(Boolean);
  return parts.length ? parts.join("-") : "-";
};

const TRADE_OPTIONS: Listing["type"][] = ["매매", "전세", "월세"];

function parseNumberInput(value?: string) {
  if (!value) return undefined;
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function LeadListTable({
  rows,
  isSelected,
  onToggleSelect,
  onOpen,
  onCommentSubmit,
  onTypeChange,
  onPriceSave,
  onToggleActive,
}: Props) {
  const [draftComments, setDraftComments] = React.useState<Record<string, string>>({});
  const [priceDrafts, setPriceDrafts] = React.useState<Record<string, { deposit: string; monthly: string }>>(
    {}
  );

  React.useEffect(() => {
    const comments: Record<string, string> = {};
    const prices: Record<string, { deposit: string; monthly: string }> = {};
    rows.forEach((row) => {
      if (!row.id) return;
      comments[row.id] = "";
      const depositValue =
        row.type === "매매" ? row.price : row.deposit;
      prices[row.id] = {
        deposit: depositValue !== undefined && depositValue !== null ? depositValue.toString() : "",
        monthly: row.monthly?.toString() || "",
      };
    });
    setDraftComments(comments);
    setPriceDrafts(prices);
  }, [rows]);

  const handleCommentChange = (id: string, value: string) => {
    setDraftComments((prev) => ({ ...prev, [id]: value }));
  };

  const handleCommentSubmit = async (id: string) => {
    const text = draftComments[id]?.trim();
    if (!text) return;
    if (!onCommentSubmit) return;
    try {
      await onCommentSubmit(id, text);
      setDraftComments((prev) => ({ ...prev, [id]: "" }));
    } catch {
      // ignore
    }
  };

  const handleTypeChange = (id: string, value: string) => {
    if (!onTypeChange) return;
    onTypeChange(id, value || undefined).catch(() => {});
  };

  const handlePriceChange = (id: string, key: "deposit" | "monthly", value: string) => {
    setPriceDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value ?? "" } }));
  };

  const handlePriceBlur = (id: string, type?: Listing["type"]) => {
    if (!onPriceSave) return;
    const draft = priceDrafts[id];
    if (!draft) return;
    const primaryValue = parseNumberInput(draft.deposit);
    const monthlyValue = parseNumberInput(draft.monthly);
    const patch: PricePatch = {};
    if (type === "매매") {
      if (primaryValue !== undefined) {
        patch.price = primaryValue;
      }
      patch.deposit = 0;
      patch.monthly = 0;
    } else if (type === "전세") {
      patch.price = 0;
      if (primaryValue !== undefined) patch.deposit = primaryValue;
      patch.monthly = 0;
    } else if (type === "월세") {
      patch.price = 0;
      if (primaryValue !== undefined) patch.deposit = primaryValue;
      if (monthlyValue !== undefined) patch.monthly = monthlyValue;
    } else {
      patch.price = 0;
      if (primaryValue !== undefined) patch.deposit = primaryValue;
      if (monthlyValue !== undefined) patch.monthly = monthlyValue;
    }
    if (Object.keys(patch).length === 0) return;
    onPriceSave(id, patch).catch(() => {});
  };

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
      <table className="w-full text-sm text-neutral-800">
        <thead className="text-[11px] text-neutral-400 uppercase tracking-wider bg-neutral-50">
          <tr>
            <th className="px-3 py-2 text-left">선택</th>
            <th className="px-3 py-2 text-left">활성</th>
            <th className="px-3 py-2 text-left">단지</th>
            <th className="px-3 py-2 text-left">동/호</th>
            <th className="px-3 py-2 text-left">면적/타입</th>
            <th className="px-3 py-2 text-left">거래</th>
            <th className="px-3 py-2 w-[200px] text-right">가격</th>
            <th className="px-3 py-2 text-left">소유자</th>
            <th className="px-3 py-2 text-left">연락처</th>
            <th className="px-3 py-2 w-[300px] text-left">덧글</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowId = row.id;
            if (!rowId) return null;
            const selected = isSelected(rowId);
            const commentText = draftComments[rowId] ?? "";
            const latestCommentText = String(row.lastCommentText ?? "").trim();
            const hasLatestComment = Boolean(latestCommentText);
            const latestCommentAuthor = String(
              row.lastCommentAuthor ?? row.assigneeName ?? row.owner ?? ""
            ).trim();
            const latestCommentTimestamp = row.lastCommentAt;
            const commentHeadingParts: string[] = [];
            if (latestCommentAuthor) commentHeadingParts.push(latestCommentAuthor);
            const formattedTimestamp = formatTimestamp(latestCommentTimestamp, false);
            if (formattedTimestamp) commentHeadingParts.push(formattedTimestamp);
            const commentHeading = commentHeadingParts.join(" · ");
            const priceDraft = priceDrafts[rowId] ?? { deposit: "", monthly: "" };
            const contact = row.phone ?? "";
            const isActive = row.isActive ?? true;
            return (
              <tr
                key={rowId}
                className="border-t border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                onClick={() => onOpen(rowId)}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleSelect(rowId);
                    }}
                    className="h-4 w-4 text-neutral-900"
                  />
                </td>
                <td className="px-3 py-2">
                  {onToggleActive ? (
                    <button
                      type="button"
                      className={`text-[11px] px-2 py-0.5 rounded-md border ${
                        isActive
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-neutral-50 border-neutral-200 text-neutral-500"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleActive(rowId, !isActive);
                      }}
                    >
                      {isActive ? "활성" : "비활성"}
                    </button>
                  ) : (
                    <span className="text-[11px] text-neutral-600">{isActive ? "활성" : "비활성"}</span>
                  )}
                </td>
                <td className="px-3 py-2 font-semibold">{row.complex ?? row.title ?? row.itemNo ?? "-"}</td>
                <td className="px-3 py-2">{formatDongHo(row)}</td>
                <td className="px-3 py-2">{formatArea(row)}</td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={row.type || ""}
                    onChange={(e) => handleTypeChange(rowId, e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 px-2 py-1 text-sm"
                  >
                    <option value="">선택</option>
                    {TRADE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  {row.type === "월세" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={priceDraft.deposit}
                        placeholder="보증금"
                        onChange={(e) => handlePriceChange(rowId, "deposit", e.target.value)}
                        onBlur={() => handlePriceBlur(rowId, row.type)}
                        className="rounded-lg border border-neutral-200 px-2 py-1 text-right text-sm"
                      />
                      <input
                        type="text"
                        value={priceDraft.monthly}
                        placeholder="월세"
                        onChange={(e) => handlePriceChange(rowId, "monthly", e.target.value)}
                        onBlur={() => handlePriceBlur(rowId, row.type)}
                        className="rounded-lg border border-neutral-200 px-2 py-1 text-right text-sm"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={priceDraft.deposit}
                      placeholder={row.type === "전세" ? "보증금" : "매매가"}
                      onChange={(e) => handlePriceChange(rowId, "deposit", e.target.value)}
                      onBlur={() => handlePriceBlur(rowId, row.type)}
                      className="w-full rounded-lg border border-neutral-200 px-2 py-1 text-right text-sm"
                    />
                  )}
                  <div className="text-[11px] text-neutral-500 mt-1 text-right">{formatPrice(row)}</div>
                </td>
                <td className="px-3 py-2">{row.owner ?? row.assigneeName ?? "-"}</td>
                <td className="px-3 py-2">
                  {contact ? (
                    <a
                      href={`tel:${String(contact).replace(/[^0-9+]/g, "")}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sky-700 hover:underline"
                    >
                      {contact}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <div className="space-y-1">
                    <div className="text-[11px] text-neutral-500 space-y-1">
                      {hasLatestComment ? (
                        <div className="truncate">
                          <div className="font-semibold text-neutral-800">{commentHeading || "댓글"}</div>
                          <div className="text-neutral-700">{latestCommentText}</div>
                        </div>
                      ) : (
                        <div className="text-neutral-400">새 덧글 없음</div>
                      )}
                    </div>
                    <textarea
                      className="w-full rounded-lg border border-neutral-200 px-2 py-1 text-[12px] leading-snug"
                      value={commentText}
                      onChange={(e) => handleCommentChange(rowId, e.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleCommentSubmit(rowId);
                        }
                      }}
                      onBlur={() => handleCommentSubmit(rowId)}
                      placeholder="덧글을 등록하세요."
                      rows={1}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default LeadListTable;
