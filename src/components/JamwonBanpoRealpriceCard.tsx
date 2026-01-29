import React from "react";

import { useJamwonBanpoRealprice, type RecentDeal } from "../hooks/useDailyRealprice";

function formatKrwEok(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  const eok = value / 100_000_000;
  const digits = Number.isInteger(eok) ? 0 : eok >= 10 ? 1 : 2;
  const txt = eok.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  return `${txt}억`;
}

function formatShortDate(date?: string) {
  if (!date) return "-";
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${year}.${Number(month)}.${Number(day)}`;
}

function sanitizeText(value?: string | number) {
  if (value == null) return "";
  return String(value)
    .replace(/[^\uAC00-\uD7A30-9a-zA-Z0-9\s().·-]/g, "")
    .trim();
}

function RecentDealsList({ items }: { items: RecentDeal[] }) {
  if (!items.length) {
    return <p className="text-xs text-neutral-400">최근 6건의 실거래 신고를 준비 중입니다.</p>;
  }

  return (
    <ul className="mt-3 space-y-2">
      {items.map((deal, idx) => (
        <li key={`${deal.complex}-${idx}`} className="flex items-center justify-between text-sm">
          <div className="flex flex-col">
            <span className="font-semibold text-neutral-900">
              {sanitizeText(deal.complex)}
              <span className="ml-1 text-[11px] text-neutral-500">{sanitizeText(deal.region)}</span>
            </span>
            <span className="text-[11px] text-neutral-500">
              {formatShortDate(deal.date)} ·{" "}
              {typeof deal.areaM2 === "number"
                ? `${deal.areaM2.toFixed(1)}㎡`
                : deal.pyeong
                ? `${sanitizeText(deal.pyeong)}평`
                : "규모 미상"}
            </span>
          </div>
          <span className="text-sm font-semibold text-sky-700">{formatKrwEok(deal.price)}</span>
        </li>
      ))}
    </ul>
  );
}

const MAX_VISIBLE = 4;
const MAX_FETCH = 50;
const LOAD_STEP = 4;

export default function JamwonBanpoRealpriceCard() {
  const { loading, recentDeals } = useJamwonBanpoRealprice(12, MAX_FETCH);
  const [visibleCount, setVisibleCount] = React.useState(MAX_VISIBLE);

  React.useEffect(() => {
    setVisibleCount(MAX_VISIBLE);
  }, [recentDeals]);

  const visibleDeals = React.useMemo(
    () => recentDeals.slice(0, visibleCount),
    [recentDeals, visibleCount]
  );
  const canLoadMore = visibleCount < recentDeals.length;

  return (
    <div className="rounded-[28px] border border-amber-100 bg-white/95 p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-amber-600">최근 실거래 신고 사례</p>
        </div>
        <div className="text-right text-[10px] text-neutral-500 leading-tight">
          <p className="text-[9px] uppercase tracking-[0.15em] text-amber-400">DAILY REPORT</p>
          <p className="text-[11px] text-neutral-400">{recentDeals.length}건</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-100 bg-neutral-50/80 p-3">
        {loading ? (
          <div className="py-8 text-center text-xs text-neutral-400">실거래 데이터를 불러오는 중입니다.</div>
        ) : (
          <>
            <div className="max-h-60 overflow-y-auto pr-1">
              <RecentDealsList items={visibleDeals} />
            </div>
            {canLoadMore ? (
              <button
                type="button"
                className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-[11px] font-semibold text-amber-600"
                onClick={() => setVisibleCount((c) => Math.min(c + LOAD_STEP, recentDeals.length))}
              >
                더보기 ({visibleCount}/{recentDeals.length})
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
