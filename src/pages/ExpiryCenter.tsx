import React from "react";
import Navbar from "../components/AppNavbar";
import { useListings } from "../state/useListings";
import { calcExpiry } from "../lib/expiry";
import ListingDetailSheet from "../components/ListingDetailSheet";
import ErrorBoundary from "../components/ErrorBoundary";

type DayCell = { date: Date; items: any[] };

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthMatrix(
  year: number,
  month: number,
  itemsByDate: Map<string, any[]>
): DayCell[][] {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const start = new Date(year, month, 1 - startDow);
  const weeks: DayCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + (w * 7 + d)
      );
      row.push({ date: cur, items: itemsByDate.get(ymdLocal(cur)) || [] });
    }
    weeks.push(row);
  }
  return weeks;
}

export default function ExpiryCenter() {
  const rows = useListings() as any[];
  const today = new Date();
  const [ym, setYm] = React.useState<{ y: number; m: number }>({
    y: today.getFullYear(),
    m: today.getMonth(),
  });
  const [mode, setMode] = React.useState<"calendar" | "list">("calendar");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");
  const [detailId, setDetailId] = React.useState<string | null>(null);

  const events = React.useMemo(() => {
    const out: Array<{ id: string; dateKey: string; row: any }> = [];
    for (const r of rows) {
      // 진행 아닌 물건만(완료/계약종료) 표시
      if (String(r?.status || "") === "진행") continue;
      // 우선순위: expiryAt(YYYY-MM-DD) > completedAt+termMonths
      if (r?.expiryAt) {
        const s = String(r.expiryAt);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          out.push({ id: r.id, dateKey: s, row: r });
          continue;
        }
        const ms = new Date(s).getTime();
        if (Number.isFinite(ms))
          out.push({ id: r.id, dateKey: ymdLocal(new Date(ms)), row: r });
        continue;
      }
      if (r?.completedAt && r?.termMonths) {
        const ms = calcExpiry(Number(r.completedAt), Number(r.termMonths));
        out.push({ id: r.id, dateKey: ymdLocal(new Date(ms)), row: r });
      }
    }
    return out;
  }, [rows]);

  const itemsByDate = React.useMemo(() => {
    const map = new Map<string, any[]>();
    for (const e of events) {
      const list = map.get(e.dateKey) || [];
      list.push(e.row);
      map.set(e.dateKey, list);
    }
    return map;
  }, [events]);

  const weeks = React.useMemo(
    () => monthMatrix(ym.y, ym.m, itemsByDate),
    [ym, itemsByDate]
  );
  const monthLabel = new Date(ym.y, ym.m, 1).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });

  const yearsAndMonths = React.useMemo(() => {
    const yset = new Set<number>();
    const byYear = new Map<number, Set<number>>();
    for (const e of events) {
      const y = Number(e.dateKey.slice(0, 4));
      const m = Number(e.dateKey.slice(5, 7)) - 1;
      if (!Number.isFinite(y) || !Number.isFinite(m)) continue;
      yset.add(y);
      if (!byYear.has(y)) byYear.set(y, new Set<number>());
      byYear.get(y)!.add(m);
    }
    // If there are no events at all, show a small range around current year
    if (yset.size === 0) {
      const base = today.getFullYear();
      for (let i = -2; i <= 2; i++) yset.add(base + i);
    }
    const years = Array.from(yset).sort((a, b) => a - b);
    return { years, byYear } as const;
  }, [events]);

  function setYear(y: number) {
    setYm((p) => ({ y, m: p.m }));
  }
  function setMonth(m: number) {
    setYm((p) => ({ y: p.y, m }));
  }
  function goToday() {
    setYm({ y: today.getFullYear(), m: today.getMonth() });
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
            <h1 className="text-2xl font-bold">만기 캘린더</h1>
            <div className="text-xs sm:text-sm text-neutral-500 mt-1 sm:mt-0">{monthLabel}</div>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2">
            <div className="inline-flex rounded-lg bg-white ring-1 ring-neutral-300 overflow-hidden shrink-0">
              <button
                className={`h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm ${mode === "calendar" ? "bg-neutral-900 text-white" : "text-neutral-800"}`}
                onClick={() => setMode("calendar")}
              >
                캘린더
              </button>
              <button
                className={`h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm ${mode === "list" ? "bg-neutral-900 text-white" : "text-neutral-800"}`}
                onClick={() => setMode("list")}
              >
                리스트
              </button>
            </div>
            {mode === "list" ? (
              <select
                className="h-8 sm:h-9 px-2 sm:px-3 rounded-lg ring-1 ring-neutral-300 bg-white text-xs sm:text-sm"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                title="정렬"
              >
                <option value="asc">오름차순</option>
                <option value="desc">내림차순</option>
              </select>
            ) : null}
          </div>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
          <select
            className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg ring-1 ring-neutral-300 bg-white text-xs sm:text-sm w-full sm:w-auto"
            value={ym.y}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearsAndMonths.years.map((yy) => (
              <option key={yy} value={yy}>
                {yy}
              </option>
            ))}
          </select>
          <button
            className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg ring-1 ring-neutral-300 text-xs sm:text-sm w-full sm:w-auto"
            onClick={goToday}
          >
            오늘
          </button>
          <div className="col-span-2 flex flex-nowrap items-center gap-[6px] sm:col-auto sm:gap-1">
            {Array.from({ length: 12 }, (_, i) => i).map((m) => {
              const has = yearsAndMonths.byYear.get(ym.y)?.has(m);
              const active = m === ym.m;
              const cls = active
                ? "bg-neutral-900 text-white ring-1 ring-neutral-900"
                : has
                ? "bg-white ring-1 ring-neutral-300 text-neutral-800 hover:bg-neutral-50"
                : "bg-white ring-1 ring-neutral-200 text-neutral-400";
              return (
                <button
                  key={m}
                  className={`h-7 sm:h-8 min-w-[1.5rem] px-1.5 sm:px-2 rounded-md text-[11px] sm:text-[12px] ${cls}`}
                  onClick={() => setMonth(m)}
                >
                  {m + 1}
                </button>
              );
            })}
          </div>
        </div>

        {mode === "calendar" ? (
        <div className="grid grid-cols-7 gap-1 sm:gap-2 select-none">
          {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
            <div
              key={w}
              className="text-center text-[12px] sm:text-sm text-neutral-500 py-1"
            >
              {w}
            </div>
          ))}
          {weeks.flatMap((row, i) =>
            row.map((cell, j) => {
              const inMonth = cell.date.getMonth() === ym.m;
              const key = `${i}-${j}`;
              return (
                <div
                  key={key}
                  className={`bg-white rounded-lg ring-1 ring-neutral-200 p-1 sm:p-2 min-h-[72px] sm:min-h-[120px] ${
                    inMonth ? "" : "opacity-50"
                  }`}
                >
                  <div className="text-[11px] sm:text-xs text-neutral-500 mb-1">
                    {cell.date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {cell.items.slice(0, 3).map((r: any) => (
                      <button
                        key={r.id}
                        onClick={() => setDetailId(r.id)}
                        className="block text-left w-full"
                      >
                        <div
                          className={
                            r?.closedByUs
                              ? "text-[11px] sm:text-[12px] leading-tight truncate text-emerald-900 bg-emerald-50 rounded px-1.5 py-0.5"
                              : "text-[11px] sm:text-[12px] leading-tight truncate"
                          }
                          title={`${r.complex ?? r.title ?? ""} ${
                            r.dong ?? ""
                          }-${r.ho ?? ""}`}
                        >
                          {(r.complex ?? r.title ?? "-") +
                            " " +
                            ((r.dong ?? "-") + "-" + (r.ho ?? "-"))}
                        </div>
                      </button>
                    ))}
                    {cell.items.length > 3 ? (
                      <div className="text-[11px] text-neutral-500">
                        외 {cell.items.length - 3}건
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
        ) : (
          <ListByMonth year={ym.y} events={events} order={sortOrder} onOpen={setDetailId} />
        )}

        {events.length === 0 ? (
          <div className="mt-4 text-neutral-500">만료 일정이 없습니다.</div>
        ) : null}
      </div>
      {detailId ? (
        <ErrorBoundary>
          <ListingDetailSheet
            open={Boolean(detailId)}
            listingId={detailId!}
            onClose={() => setDetailId(null)}
            actions={{ save: true, reopen: true }}
          />
        </ErrorBoundary>
      ) : null}
    </div>
  );
}

function ListByMonth({
  year,
  events,
  order,
  onOpen,
}: {
  year: number;
  events: Array<{ id: string; dateKey: string; row: any }>;
  order: "asc" | "desc";
  onOpen: (id: string) => void;
}) {
  const groups = React.useMemo(() => {
    const m = new Map<string, Array<{ id: string; dateKey: string; row: any }>>();
    for (const e of events) {
      if (Number(e.dateKey.slice(0, 4)) !== year) continue;
      const key = e.dateKey.slice(0, 7); // YYYY-MM
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    }
    const sortedKeys = Array.from(m.keys()).sort((a, b) => (order === "asc" ? (a < b ? -1 : 1) : (a > b ? -1 : 1)));
    for (const k of sortedKeys) {
      m.get(k)!.sort((a, b) => (order === "asc" ? (a.dateKey < b.dateKey ? -1 : 1) : (a.dateKey > b.dateKey ? -1 : 1)));
    }
    return { keys: sortedKeys, map: m } as const;
  }, [events, year, order]);

  if (groups.keys.length === 0) {
    return <div className="text-neutral-500">해당 연도에 만료 일정이 없습니다.</div>;
  }

  return (
    <div className="space-y-4">
      {groups.keys.map((k) => {
        const [yy, mm] = k.split("-").map((x) => Number(x));
        const monthLabel = new Date(yy, (mm || 1) - 1, 1).toLocaleDateString(undefined, { month: "long" });
        const items = groups.map.get(k)!;
        return (
          <section key={k} className="bg-white rounded-xl ring-1 ring-neutral-200">
            <div className="px-3 py-2 text-sm font-semibold text-neutral-800 border-b border-neutral-200 flex items-center justify-between">
              <div>{yy}. {String(mm).padStart(2, "0")} ({monthLabel})</div>
              <div className="text-xs text-neutral-500">{items.length}건</div>
            </div>
            <div className="p-2 divide-y divide-neutral-100">
              {items.map((e) => (
                <button key={e.id} onClick={() => onOpen(e.id)} className="w-full text-left py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-16 shrink-0 text-[12px] text-neutral-500">{e.dateKey.slice(5)}</div>
                    <div
                      className={
                        e.row?.closedByUs
                          ? "flex-1 text-[12px] sm:text-[13px] truncate text-emerald-900 bg-emerald-50 rounded px-1.5 py-0.5"
                          : "flex-1 text-[12px] sm:text-[13px] truncate"
                      }
                      title={`${e.row.complex ?? e.row.title ?? ""} ${e.row.dong ?? ""}-${e.row.ho ?? ""}`}
                    >
                      {(e.row.complex ?? e.row.title ?? "-") + " " + ((e.row.dong ?? "-") + "-" + (e.row.ho ?? "-"))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
