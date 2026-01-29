import React from "react";
import Navbar from "../components/AppNavbar";
import { Search, Info } from "lucide-react";
import { useBuyers } from "../state/useBuyers";
import { useListings } from "../state/useListings";
import { listUserProfiles, type UserProfile } from "../lib/users";
import { useAuth } from "../context/AuthContext";
import { useMatches } from "../state/useMatches";
import { useSelection } from "../context/SelectionContext";
import BuyerNewSheet from "../components/BuyerNewSheet";
import BuyerDetailSheet from "../components/BuyerDetailSheet";

function formatBudget(min?: number, max?: number) {
  const fmt = (n?: number) => (n != null ? n.toLocaleString() : "-");
  if (min == null && max == null) return "-";
  return `${fmt(min)} ~ ${fmt(max)} \uB9CC\uC6D0`;
}

export default function Buyers2() {
  const rows = useBuyers();
  useListings?.();
  const matches = useMatches();
  const { setMany } = useSelection("listings");
  const { user } = useAuth();

  const [query, setQuery] = React.useState("");
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [viewMode, setViewMode] = React.useState<"cards" | "list">(() => {
    try {
      const v = localStorage.getItem("rj_buyers_view");
      return v === "list" || v === "cards" ? (v as any) : "cards";
    } catch {
      return "cards";
    }
  });
  const [newOpen, setNewOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);

  React.useEffect(() => {
    listUserProfiles()
      .then((all) => setUsers(all.filter((u) => u.role === "owner" || u.role === "admin" || u.role === "staff")))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    try { localStorage.setItem("rj_buyers_view", viewMode); } catch {}
  }, [viewMode]);

  const items = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows as any[];
    return (rows as any[]).filter((b: any) => {
      const hay = [
        b.name,
        b.phone,
        b.notes,
        ...(b.mustHaves ?? []),
        ...(b.complexPrefs ?? []),
        b.assignedTo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  const canSeePhone = (b: any) => {
    const email = String((user as any)?.email || "").toLowerCase();
    const uid = String((user as any)?.uid || "");
    if ((user as any)?.role === "owner" || (user as any)?.role === "admin") return true;
    const createdEmail = String(b?.createdByEmail || "").toLowerCase();
    const createdUid = String(b?.createdByUid || "");
    if ((email && email === createdEmail) || (uid && uid === createdUid)) return true; // 입력자
    const meKey = email || String((user as any)?.name || "").toLowerCase();
    const assg = String(b?.assignedTo || "").toLowerCase();
    return !!meKey && assg.includes(meKey); // 담당자
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">{"\uB9E4\uC218\uC790 \uAD00\uB9AC"}</h1>
          <div className="flex items-center gap-2">
            <div className="text-sm text-neutral-600">{"\uCD1D "}{items.length}{"\uBA85"}</div>
            <div className="inline-flex rounded-lg bg-white ring-1 ring-neutral-300 overflow-hidden">
              <button
                type="button"
                className={`h-9 px-3 text-sm ${viewMode === "cards" ? "bg-neutral-900 text-white" : "text-neutral-800"}`}
                onClick={() => setViewMode("cards")}
                title={"\uCE74\uB4DC"}
              >
                {"\uCE74\uB4DC"}
              </button>
              <button
                type="button"
                className={`h-9 px-3 text-sm ${viewMode === "list" ? "bg-neutral-900 text-white" : "text-neutral-800"}`}
                onClick={() => setViewMode("list")}
                title={"\uB9AC\uC2A4\uD2B8"}
              >
                {"\uB9AC\uC2A4\uD2B8"}
              </button>
            </div>
            <button type="button" onClick={() => setNewOpen(true)} className="h-9 px-3 rounded-lg bg-neutral-900 text-white text-sm flex items-center">{"\uC2E0\uADDC \uB9E4\uC218\uC790"}</button>
          </div>
        </div>

        <div className="mb-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              placeholder={"\uC774\uB984/\uC5F0\uB77D\uCC98/\uBA54\uBAA8/\uD0A4\uC6CC\uB4DC \uAC80\uC0C9"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-9 pr-3 rounded-lg border border-neutral-200 bg-white w-full text-sm"
            />
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-neutral-500">{`\uC870\uAC74\uC5D0 \uB9DE\uB294 \uB9E4\uC218\uC790\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.`}</div>
        ) : viewMode === "list" ? (
          <div className="space-y-2">
            {(items as any[]).map((b: any) => {
              const top = matches.getForBuyer(b.id, 10);
              const count = top.length;
              return (
                <div key={b.id} className="bg-white rounded-xl ring-1 ring-neutral-200 px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm sm:text-base font-semibold truncate">{b.name || "-"}</div>
                    <div className="text-xs sm:text-sm text-neutral-600 truncate">
                      {canSeePhone(b) ? (b.phone || "-") : <span className="text-neutral-400">{"\uBE44\uACF5\uAC1C"}</span>}
                    </div>
                    <div className="text-[12px] sm:text-sm text-neutral-600">{"\uC608\uC0B0 "}{formatBudget(b.budgetMin, b.budgetMax)}</div>
                  </div>
                  <div className="flex-[1.2] min-w-0">
                    <div className="text-sm sm:text-base text-neutral-900 truncate">{b.notes || "-"}</div>
                    {b.lastCommentText ? (
                      <div className="mt-2 text-[12px] sm:text-sm text-emerald-700 bg-emerald-50 rounded px-2 py-1 truncate">{b.lastCommentText}</div>
                    ) : null}
                  </div>
                  <div className="flex-none flex items-center gap-2">
                    <button className="text-blue-600 text-sm hover:underline inline-flex items-center gap-1" onClick={() => setDetailId(b.id)}>
                      <Info className="w-4 h-4" /> {"\uC0C1\uC138 \uBCF4\uAE30"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!count) return;
                        const ids = top.map((m: any) => m.id);
                        try { setMany(ids); } catch {}
                        // navigation to selected page can be triggered elsewhere
                      }}
                      disabled={count === 0}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${count > 0 ? "text-emerald-800 bg-emerald-100 hover:bg-emerald-200" : "text-neutral-400 bg-neutral-100 cursor-not-allowed"}`}
                      title={"\uB9E4\uCE6D\uB41C \uB9E4\uBB3C \uC120\uD0DD"}
                      aria-label={`\uB9E4\uCE6D ${count}`}
                    >
                      {"\uB9E4\uCE6D"} <span className="ml-0.5 font-semibold">{count}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {(items as any[]).map((b: any) => (
              <div key={b.id} className="bg-white rounded-2xl ring-1 ring-neutral-200 px-4 py-5">
                <div className="text-base font-semibold">{b.name || "-"}</div>
                <div className="text-sm text-neutral-700 mt-0.5">{canSeePhone(b) ? (b.phone || "-") : <span className="text-neutral-400">{"\uBE44\uACF5\uAC1C"}</span>}</div>
                <div className="text-sm text-neutral-700 mt-0.5">{"\uC608\uC0B0 "}{formatBudget(b.budgetMin, b.budgetMax)}</div>
                <div className="mt-0.5 text-sm text-neutral-700">{`\uD76C\uB9DD \uB2E8\uC9C0 ${((b.complexPrefs ?? []) as string[]).join(", ") || "-"}`}</div>
                <div className="mt-0.5 text-sm text-neutral-700">{`\uD76C\uB9DD \uBA74\uC801 ${((b.areaPrefsPy ?? []) as any[]).join(", ") || "-"}`}</div>
                <div className="mt-0.5 text-sm text-neutral-700 line-clamp-1 min-h-[1.25rem]">{b.notes || "-"}</div>
                {b.lastCommentText ? (<div className="mt-1 text-[12px] text-emerald-700 bg-emerald-50 rounded px-2 py-1 line-clamp-2">{b.lastCommentText}</div>) : null}
                <div className="mt-2 flex items-center justify-between">
                  <button className="text-blue-600 text-sm hover:underline inline-flex items-center gap-1" onClick={() => setDetailId(b.id)}>
                    <Info className="w-4 h-4" /> {"\uC0C1\uC138 \uBCF4\uAE30"}
                  </button>
                  {(() => {
                    const top = matches.getForBuyer(b.id, 10);
                    const count = top.length;
                    return (
                      <button type="button" disabled={count === 0} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${count > 0 ? "text-emerald-800 bg-emerald-100 hover:bg-emerald-200" : "text-neutral-400 bg-neutral-100 cursor-not-allowed"}`} title={"\uB9E4\uCE6D\uB41C \uB9E4\uBB3C \uC120\uD0DD"} aria-label={`\uB9E4\uCE6D ${count}`}>
                        {"\uB9E4\uCE6D"} <span className="ml-0.5 font-semibold">{count}</span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BuyerNewSheet open={newOpen} onClose={() => setNewOpen(false)} onCreated={() => { /* close only */ }} />
      {detailId ? (<BuyerDetailSheet open={Boolean(detailId)} buyerId={detailId!} onClose={() => setDetailId(null)} />) : null}
    </div>
  );
}

