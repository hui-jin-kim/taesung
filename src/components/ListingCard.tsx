import React from "react";
import { CheckSquare, Square, Search, ChevronRight, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useBuyers as useBuyersState } from "../state/useBuyers";
import { useMatches } from "../state/useMatches";
import type { MatchEntry } from "../types/match";
import { formatKRW, formatAreaPy, mergeAreaSuffix } from "../lib/format";
import type { Listing } from "../types/core";

type Mode = "listings" | "completed" | "ourdeals";

type Props = {
  row: any;
  mode: Mode;
  onDetail: (id: string) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  matchCount?: number;
  showDong?: boolean;
  showHo?: boolean;
  onDelete?: (id: string) => void;
  onToggleActive?: (id: string, next: boolean) => void;
  onStatusChange?: (id: string, next: Listing["status"]) => void;
  statusOptions?: Array<{ value: Listing["status"]; label: string }>;
};

function truncateByBytes(text: string, maxBytes: number) {
  const s = (text || "").replace(/\s+/g, " ").trim();
  let used = 0;
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    const len = cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4;
    if (used + len > maxBytes) break;
    used += len;
    out += ch;
  }
  return out.length < s.length ? `${out.trimEnd()}...` : out;
}

function formatBuyerBudget(min?: number, max?: number) {
  const fmt = (value?: number) => (value != null ? `${value.toLocaleString()}만원` : "-");
  if (min == null && max == null) return "-";
  if (min != null && max != null) return `${fmt(min)} ~ ${fmt(max)}`;
  if (min != null) return `${fmt(min)} 이상`;
  return `${fmt(max)} 이하`;
}

function formatBuyerTypes(values?: string[]) {
  return values && values.length ? values.join(", ") : "희망 유형 없음";
}

function formatBuyerAreas(values?: Array<string | number>) {
  if (!values || values.length === 0) return "-";
  return values.map((v) => `${v}평`).join(", ");
}

export default function ListingCard({
  row: r,
  mode,
  onDetail,
  selected = false,
  onToggleSelect,
  matchCount = 0,
  showDong = true,
  showHo = true,
  onDelete,
  onToggleActive,
  onStatusChange,
  statusOptions,
}: Props) {
  const nav = useNavigate();
  const buyersAll = useBuyersState();
  const matches = useMatches();
  const [matchDrawerOpen, setMatchDrawerOpen] = React.useState(false);
  const [matchDrawerEntries, setMatchDrawerEntries] = React.useState<MatchEntry[]>([]);

  const hasMemo = Boolean(r?.memo && String(r.memo).trim());
  const memoText = hasMemo ? String(r.memo).trim() : "";
  const isComment = Boolean(r?.lastCommentText && String(r.lastCommentText).trim());
  const commentText = isComment ? String(r.lastCommentText).trim() : "";

  const ownershipLabel =
    r?.ownershipType === "partner"
      ? "\uD0C0\uC0AC"
      : r?.ownershipType === "our"
      ? "\uC6B0\uB9AC"
      : null;
  const ownershipBadgeClass =
    ownershipLabel === "\uC6B0\uB9AC"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-neutral-100 text-neutral-600";

  const priceDisplay = (() => {
    const type = String(r?.type || "");
    if (type === "\uB9E4\uB9E4") return r?.price != null ? formatKRW(r.price) : "-";
    if (type === "\uC804\uC138") return r?.deposit != null ? formatKRW(r.deposit) : "-";
    if (type === "\uC6D4\uC138") {
      const d = r?.deposit != null ? formatKRW(r.deposit) : "-";
      const m = r?.monthly != null ? formatKRW(r.monthly) : "-";
      return `${d}/${m}`;
    }
    if (r?.price != null) return formatKRW(r.price);
    if (r?.deposit != null || r?.monthly != null) {
      const d = r.deposit != null ? formatKRW(r.deposit) : "";
      const m = r.monthly != null ? formatKRW(r.monthly) : "";
      return `${d}${m ? `/${m}` : ""}` || "-";
    }
    return "-";
  })();

  const titleLine = (() => {
    const parts: string[] = [];
    const base = r?.complex ?? r?.title ?? "";
    if (base) parts.push(base);
    const dong = showDong ? r?.dong || "" : "";
    const ho = showHo ? r?.ho || "" : "";
    const dh = [dong, ho].filter(Boolean).join("-");
    if (dh) parts.push(dh);
    return parts.join(" ");
  })();

  const typeTone = (type?: string) => {
    const k = String(type || "");
    if (k.includes("\uB9E4\uB9E4")) return "text-rose-800 bg-rose-100";
    if (k.includes("\uC804\uC138")) return "text-sky-800 bg-sky-100";
    if (k.includes("\uC6D4\uC138")) return "text-amber-800 bg-amber-100";
    return "bg-neutral-800 text-white";
  };

  const isActive = r?.isActive ?? true;
  const agencyText = (r?.agency ? String(r.agency) : "").trim();
  const ownerText = (r?.owner ? String(r.owner) : "").trim();
  const contactLabel = [ownerText, agencyText].filter(Boolean).join(" / ");

  const handleMatchClick = () => {
    const entries = matches.getForListing(String(r.id), 200);
    if (!entries.length) {
      nav(`/buyers?matchFor=${encodeURIComponent(String(r.id))}` as any);
      return;
    }
    setMatchDrawerEntries(entries);
    setMatchDrawerOpen(true);
  };

  return (
    <>
      <div
      className={`bg-white rounded-2xl shadow-sm ring-1 ring-neutral-200 overflow-hidden h-full ${
        selected ? "ring-2 ring-blue-500" : r?.urgent ? "ring-2 ring-red-300" : ""
      }`}
    >
      <div className="flex items-center justify-between h-9 sm:h-10 px-2 sm:px-3 bg-neutral-100">
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${typeTone(r?.type)}`}>
            {r?.type ?? "-"}
          </span>
          {ownershipLabel ? (
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${ownershipBadgeClass}`}>
              {ownershipLabel}
            </span>
          ) : null}
          {mode === "listings" && matchCount > 0 ? (
            <button
              type="button"
              onClick={handleMatchClick}
              className="inline-flex items-center text-emerald-800 bg-emerald-100 rounded-full px-1.5 py-0.5 text-[11px] hover:bg-emerald-200"
              title="\uB9E4\uCE6D \uD6C4\uBCF4 \uBCF4\uAE30"
            >
              \uB9E4\uCE6D <span className="ml-0.5 font-semibold">{matchCount}</span>
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          {onStatusChange && statusOptions?.length ? (
            <select
              className="hidden sm:inline-block text-[11px] bg-white rounded-md border border-neutral-300 px-2 py-0.5"
              value={String(r?.status ?? "")}
              onChange={(e) => onStatusChange(r.id, e.target.value as Listing["status"])}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : null}
          {onToggleActive ? (
            <button
              type="button"
              className={`text-[11px] px-2 py-0.5 rounded-md border ${
                isActive
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-neutral-50 border-neutral-200 text-neutral-500"
              }`}
              onClick={() => onToggleActive(r.id, !isActive)}
            >
              {isActive ? "활성" : "비활성"}
            </button>
          ) : null}
          {r?.assigneeName ? (
            <span className="text-[11px] text-neutral-700 truncate max-w-[140px]" title={String(r.assigneeName)}>
              {String(r.assigneeName)}
            </span>
          ) : null}
          <div className="flex items-center gap-1.5">
            {onDelete ? (
              <button
                type="button"
                className="bg-white/90 rounded-md p-1 shadow text-red-600 hover:bg-red-50"
                onClick={() => onDelete(r.id)}
                aria-label="delete"
                title="\uC0AD\uC81C"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : null}
            {onToggleSelect ? (
              <button
                className="bg-white/90 rounded-md p-1 shadow"
                onClick={() => onToggleSelect(r.id)}
                aria-label="select"
              >
                {selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-4 py-5 text-base flex flex-col h-full">
        <div className="text-base font-semibold">{titleLine}</div>
        <div className="text-sm text-neutral-700 mt-0.5">{`${formatAreaPy(
          r?.area_py,
          mergeAreaSuffix(r?.areaSuffix, r?.typeSuffix)
        )} · ${
          r?.type ?? "-"
        } ${priceDisplay}`}</div>

        <div className="text-sm text-neutral-700 mt-0.5 line-clamp-1 min-h-[1.25rem]">
          {hasMemo ? truncateByBytes(memoText, 60) : "\u00A0"}
        </div>
        <div
          className={`mt-0.5 text-[12px] rounded px-2 py-0.5 line-clamp-2 min-h-[2.25rem] ${
            isComment ? "text-emerald-700 bg-emerald-50" : "text-transparent"
          }`}
        >
          {isComment ? truncateByBytes(commentText, 140) : "\u00A0"}
        </div>

        <div className="mt-1 flex items-center gap-2">
          <button
            onClick={() => onDetail(r.id)}
            className="inline-flex items-center gap-1 h-8 px-2 rounded-lg bg-white ring-1 ring-neutral-200 text-neutral-800 text-[12px] font-medium whitespace-nowrap hover:bg-neutral-50 shrink-0"
            aria-label="자세히"
          >
            <Search className="w-4 h-4 text-neutral-600" />
            <span>자세히</span>
            <ChevronRight className="w-4 h-4 text-neutral-600" />
          </button>
          <div className="text-right flex-1 min-w-0 leading-snug">
            {mode === "listings" && contactLabel ? (
              <div className="text-[11px] sm:text-[12px] text-neutral-700 font-semibold truncate" title={contactLabel}>
                {contactLabel}
              </div>
            ) : agencyText ? (
              <div className="text-[11px] text-neutral-600 truncate" title={agencyText}>
                {agencyText}
              </div>
            ) : null}
            {(() => {
              const phoneText = r?.phone ? String(r.phone) : "";
              const hasPhone = !!phoneText;
              const tel = hasPhone ? phoneText.replace(/[^0-9+]/g, "") : "";
              return (
                <div className="text-base font-semibold text-neutral-900 truncate" title={hasPhone ? phoneText : undefined}>
                  {hasPhone ? (
                    <a href={`tel:${tel}`} className="hover:underline text-inherit">
                      {phoneText}
                    </a>
                  ) : (
                    "-"
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      </div>
      {matchDrawerOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setMatchDrawerOpen(false)}>
          <div className="w-full max-w-md bg-white h-full shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <div className="text-xs text-neutral-500">매칭된 매수자</div>
                <div className="text-sm font-semibold">{titleLine}</div>
              </div>
              <button
                type="button"
                className="text-sm text-neutral-600 hover:text-neutral-900"
                onClick={() => setMatchDrawerOpen(false)}
              >
                닫기
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {matchDrawerEntries.length === 0 ? (
                <div className="p-4 text-sm text-neutral-500">조건에 맞는 매수자가 없습니다.</div>
              ) : (
                matchDrawerEntries.map((entry) => {
                  const buyer = buyersAll?.find((b: any) => String(b.id) === String(entry.id));
                  if (!buyer) return null;
                  return (
                    <div key={entry.id} className="px-4 py-3 text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-neutral-900">{buyer?.name || "-"}</div>
                        <span className="text-[11px] text-neutral-500">score {entry.score}</span>
                      </div>
                      <div className="text-[12px] text-neutral-500">{formatBuyerTypes(buyer?.typePrefs)}</div>
                      <div className="text-[12px] text-neutral-500">예산 {formatBuyerBudget(buyer?.budgetMin, buyer?.budgetMax)}</div>
                      <div className="text-[12px] text-neutral-500">선호 면적 {formatBuyerAreas(buyer?.areaPrefsPy)}</div>
                      <div className="text-[12px] text-neutral-600 line-clamp-2">{buyer?.notes || "-"}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
