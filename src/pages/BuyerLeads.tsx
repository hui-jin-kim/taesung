import React from "react";
import Navbar from "../components/AppNavbar";
import { Search } from "lucide-react";
import {
  BuyerLeadDoc,
  createBuyerLead,
  removeBuyerLead,
  updateBuyerLead,
  useBuyerLeads,
} from "../lib/buyerLeads";
import { listUserProfiles, UserProfile } from "../lib/users";
import { useListings } from "../state/useListings";
import CommentThread from "../components/CommentThread";
import { formatKRW, formatTimestamp } from "../lib/format";
import type { Listing } from "../types/core";

type StatusFilter = "all" | BuyerLeadDoc["status"];
type BuyerTypeFilter = "all" | "매수" | "임차";

const STATUS_LABEL: Record<Exclude<StatusFilter, "all">, string> = {
  active: "활동중",
  in_progress: "상담중",
  matched: "매칭완료",
};

const BUYER_TYPE_OPTIONS: Array<{ value: BuyerTypeFilter; label: string }> = [
  { value: "all", label: "구분 전체" },
  { value: "매수", label: "매수" },
  { value: "임차", label: "임차" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-[12px] text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function parseNumberFromText(value?: string) {
  if (!value) return undefined;
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return undefined;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeListingStatus(status?: Listing["status"]) {
  if (!status) return "진행";
  const text = String(status);
  if (text.includes("계약") && !text.includes("진행")) return "종료";
  return text;
}

function normalizeListingType(type?: Listing["type"]) {
  if (!type) return "";
  if (type.startsWith("매")) return "매매";
  if (type.startsWith("전")) return "전세";
  if (type.startsWith("월")) return "월세";
  return type;
}

function computeMatches(buyer: BuyerLeadDoc, listings: Listing[]) {
  const activeListings = listings.filter((listing) => normalizeListingStatus(listing.status) === "진행");
  const buyerType = buyer.type === "임차" ? "임차" : "매수";
  const budgetValue = parseNumberFromText(buyer.budget);
  const areaValue = parseNumberFromText(buyer.preferredArea);
  const keywords = (buyer.requirements || "")
    .split(/\s+/)
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);

  return activeListings
    .filter((listing) => {
      const type = normalizeListingType(listing.type);
      if (buyerType === "매수" && type !== "매매") return false;
      if (buyerType === "임차" && type === "매매") return false;

      if (budgetValue != null) {
        if (type === "매매") {
          if (listing.price != null && listing.price > budgetValue) return false;
        } else {
          const deposit = listing.deposit ?? 0;
          const monthly = listing.monthly ?? 0;
          if (deposit > budgetValue && monthly > budgetValue) return false;
        }
      }

      if (areaValue != null && listing.area_py != null) {
        const diff = Math.abs(listing.area_py - areaValue);
        if (diff > 5) return false;
      }

      if (keywords.length > 0) {
        const haystack = [
          listing.complex,
          listing.title,
          listing.memo,
          listing.dong,
          listing.ho,
          listing.assigneeName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const missing = keywords.some((keyword) => !haystack.includes(keyword));
        if (missing) return false;
      }

      if (buyer.preferredArea) {
        const preferred = buyer.preferredArea.toLowerCase();
        const haystack = [listing.complex, listing.dong].filter(Boolean).join(" ").toLowerCase();
        if (preferred && haystack && !haystack.includes(preferred)) return false;
      }

      return true;
    })
    .map((listing) => {
      const scoreParts: number[] = [];
      if (listing.price != null && budgetValue != null) {
        const diff = Math.abs(listing.price - budgetValue);
        scoreParts.push(1 / (1 + diff));
      }
      if (listing.area_py != null && areaValue != null) {
        const diff = Math.abs(listing.area_py - areaValue);
        scoreParts.push(1 / (1 + diff));
      }
      if (keywords.length > 0) {
        const haystack = [
          listing.complex,
          listing.title,
          listing.memo,
          listing.dong,
          listing.ho,
          listing.assigneeName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const matched = keywords.filter((keyword) => haystack.includes(keyword)).length;
        scoreParts.push(matched / keywords.length);
      }
      const score =
        scoreParts.length > 0 ? scoreParts.reduce((total, value) => total + value, 0) / scoreParts.length : 0.5;
      return { listing, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export default function BuyerLeads() {
  const leads = useBuyerLeads();
  const listings = useListings() as Listing[];
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = React.useState<BuyerTypeFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = React.useState("");
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [detailDraft, setDetailDraft] = React.useState<Partial<BuyerLeadDoc> | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    type: "매수" as "매수" | "임차",
    phone: "",
    email: "",
    preferredArea: "",
    budget: "",
    requirements: "",
    memo: "",
    nextAction: "",
    assigneeUid: "",
  });

  React.useEffect(() => {
    listUserProfiles()
      .then((records) => setUsers(records.filter((profile) => profile.role === "owner" || profile.role === "admin" || profile.role === "staff")))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!detailId) {
      setDetailDraft(null);
      return;
    }
    const target = leads.find((lead) => lead.id === detailId);
    setDetailDraft(target ? { ...target } : null);
  }, [detailId, leads]);

  const filteredLeads = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads
      .filter((lead) => (statusFilter === "all" ? true : lead.status === statusFilter))
      .filter((lead) => (typeFilter === "all" ? true : lead.type === typeFilter))
      .filter((lead) => (assigneeFilter ? lead.assigneeUid === assigneeFilter : true))
      .filter((lead) => {
        if (!q) return true;
        const haystack = [
          lead.name,
          lead.phone,
          lead.email,
          lead.preferredArea,
          lead.budget,
          lead.requirements,
          lead.memo,
          lead.nextAction,
          lead.assigneeName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
  }, [leads, statusFilter, typeFilter, assigneeFilter, query]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      alert("Name is required.");
      return;
    }
    setCreating(true);
    try {
      const assignee = users.find((user) => user.uid === form.assigneeUid);
      await createBuyerLead({
        name: form.name.trim(),
        type: form.type,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        preferredArea: form.preferredArea.trim() || undefined,
        budget: form.budget.trim() || undefined,
        requirements: form.requirements.trim() || undefined,
        memo: form.memo.trim() || undefined,
        nextAction: form.nextAction.trim() || undefined,
        assigneeUid: form.assigneeUid || undefined,
        assigneeName: assignee ? assignee.name || assignee.email : undefined,
      });
      setForm({
        name: "",
        type: "매수",
        phone: "",
        email: "",
        preferredArea: "",
        budget: "",
        requirements: "",
        memo: "",
        nextAction: "",
        assigneeUid: "",
      });
    } catch (error: any) {
      alert(error?.message ?? "Failed to create buyer lead.");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveDetail = async () => {
    if (!detailId || !detailDraft) return;
    await updateBuyerLead(detailId, detailDraft);
  };

  const handleDeleteDetail = async () => {
    if (!detailId) return;
    if (!window.confirm("Delete this buyer lead?")) return;
    await removeBuyerLead(detailId);
    setDetailId(null);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section className="bg-white rounded-2xl ring-1 ring-neutral-200 p-5">
          <h2 className="text-lg font-semibold mb-4">New Buyer Lead</h2>
          <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </Field>
            <Field label="Type">
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.type}
                onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as "매수" | "임차" }))}
              >
                <option value="매수">매수 (purchase)</option>
                <option value="임차">임차 (rent)</option>
              </select>
            </Field>
            <Field label="Phone">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </Field>
            <Field label="Email">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </Field>
            <Field label="Preferred area / district">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.preferredArea}
                onChange={(e) => setForm((prev) => ({ ...prev, preferredArea: e.target.value }))}
              />
            </Field>
            <Field label="Budget (numbers only)">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.budget}
                onChange={(e) => setForm((prev) => ({ ...prev, budget: e.target.value }))}
              />
            </Field>
            <Field label="Requirements / keywords">
              <textarea
                className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
                value={form.requirements}
                onChange={(e) => setForm((prev) => ({ ...prev, requirements: e.target.value }))}
              />
            </Field>
            <Field label="Memo">
              <textarea
                className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
                value={form.memo}
                onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))}
              />
            </Field>
            <Field label="Next action">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.nextAction}
                onChange={(e) => setForm((prev) => ({ ...prev, nextAction: e.target.value }))}
              />
            </Field>
            <Field label="Assignee">
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.assigneeUid}
                onChange={(e) => setForm((prev) => ({ ...prev, assigneeUid: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.uid} value={user.uid}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="h-9 px-4 rounded-lg bg-neutral-900 text-white text-sm disabled:opacity-50"
              >
                {creating ? "Saving..." : "Save lead"}
              </button>
            </div>
          </form>
        </section>

        <section className="bg-white rounded-2xl ring-1 ring-neutral-200 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search buyers (name, memo, phone...)"
                  className="h-9 pl-9 pr-3 rounded-lg border border-neutral-200 bg-white w-full text-sm"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="h-9 px-2 rounded-lg border border-neutral-200 bg-white text-sm"
              >
                <option value="all">상태 전체</option>
                <option value="active">{STATUS_LABEL.active}</option>
                <option value="in_progress">{STATUS_LABEL.in_progress}</option>
                <option value="matched">{STATUS_LABEL.matched}</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as BuyerTypeFilter)}
                className="h-9 px-2 rounded-lg border border-neutral-200 bg-white text-sm"
              >
                {BUYER_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="h-9 px-2 rounded-lg border border-neutral-200 bg-white text-sm"
              >
                <option value="">담당 전체</option>
                {users.map((user) => (
                  <option key={user.uid} value={user.uid}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-neutral-600">
              총 {leads.length}명 · 표시 {filteredLeads.length}명
            </div>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="text-neutral-500">No buyer leads found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredLeads.map((lead) => {
                const matches = computeMatches(lead, listings);
                return (
                  <div
                    key={lead.id}
                    className="bg-neutral-50 rounded-xl ring-1 ring-neutral-200 p-4 shadow-sm hover:shadow-md transition cursor-pointer"
                    onClick={() => setDetailId(lead.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-sm font-semibold">{lead.name}</div>
                        <div className="text-xs text-neutral-500">
                          {lead.type} · {lead.phone || lead.email || "no contact"}
                        </div>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                        {lead.status ? STATUS_LABEL[lead.status] ?? lead.status : "미정"}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-600 space-y-1">
                      <div>Budget: {lead.budget || "-"}</div>
                      <div>Preferred: {lead.preferredArea || "-"}</div>
                      <div>Next action: {lead.nextAction || "-"}</div>
                    </div>
                    <div className="mt-3 text-xs text-neutral-500">
                      Matches ({matches.length})
                    </div>
                    <div className="mt-1 space-y-1">
                      {matches.length === 0 ? (
                        <div className="text-xs text-neutral-400">No listing matched.</div>
                      ) : (
                        matches.map(({ listing }) => (
                          <div
                            key={listing.id}
                            className="text-xs bg-white border border-neutral-200 rounded px-2 py-1 flex items-center justify-between gap-2"
                          >
                            <div className="truncate">
                              {listing.complex ?? listing.title} {listing.dong ?? ""}-
                              {listing.ho ?? ""}
                            </div>
                            <div className="text-neutral-500">{formatKRW(listing.price ?? listing.deposit)}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {detailId && detailDraft && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3"
          onClick={() => setDetailId(null)}
        >
          <div
            className="bg-white max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid md:grid-cols-2 gap-0">
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-neutral-500">Buyer lead</div>
                    <h3 className="text-lg font-bold mt-1">{detailDraft.name}</h3>
                    <div className="text-xs text-neutral-500">
                      Last updated: {formatTimestamp(detailDraft.updatedAt) || "-"}
                    </div>
                  </div>
                  <select
                    value={detailDraft.status ?? "active"}
                    onChange={(e) =>
                      setDetailDraft((prev) => ({ ...(prev ?? {}), status: e.target.value as BuyerLeadDoc["status"] }))
                    }
                    className="h-9 px-2 rounded-lg border border-neutral-200 bg-white text-sm"
                  >
                    <option value="active">활동중</option>
                    <option value="in_progress">상담중</option>
                    <option value="matched">매칭완료</option>
                  </select>
                </div>

                <div className="grid gap-3 text-sm">
                  <Field label="Type">
                    <select
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={detailDraft.type ?? "매수"}
                      onChange={(e) => setDetailDraft((prev) => ({ ...(prev ?? {}), type: e.target.value }))}
                    >
                      <option value="매수">매수</option>
                      <option value="임차">임차</option>
                    </select>
                  </Field>
                  <Field label="Assignee">
                    <select
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={detailDraft.assigneeUid ?? ""}
                      onChange={(e) => {
                        const uid = e.target.value;
                        const assignee = users.find((item) => item.uid === uid);
                        setDetailDraft((prev) => ({
                          ...(prev ?? {}),
                          assigneeUid: uid || undefined,
                          assigneeName: uid ? assignee?.name || assignee?.email || "" : undefined,
                        }));
                      }}
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.uid} value={user.uid}>
                          {user.name || user.email}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Phone">
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={detailDraft.phone ?? ""}
                      onChange={(e) => setDetailDraft((prev) => ({ ...(prev ?? {}), phone: e.target.value }))}
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={detailDraft.email ?? ""}
                      onChange={(e) => setDetailDraft((prev) => ({ ...(prev ?? {}), email: e.target.value }))}
                    />
                  </Field>
                  <Field label="Preferred area">
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={detailDraft.preferredArea ?? ""}
                      onChange={(e) =>
                        setDetailDraft((prev) => ({ ...(prev ?? {}), preferredArea: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Budget">
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={detailDraft.budget ?? ""}
                      onChange={(e) => setDetailDraft((prev) => ({ ...(prev ?? {}), budget: e.target.value }))}
                    />
                  </Field>
                  <Field label="Requirements">
                    <textarea
                      className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
                      value={detailDraft.requirements ?? ""}
                      onChange={(e) => setDetailDraft((prev) => ({ ...(prev ?? {}), requirements: e.target.value }))}
                    />
                  </Field>
                  <Field label="Memo">
                    <textarea
                      className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
                      value={detailDraft.memo ?? ""}
                      onChange={(e) => setDetailDraft((prev) => ({ ...(prev ?? {}), memo: e.target.value }))}
                    />
                  </Field>
                  <Field label="Next action">
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={detailDraft.nextAction ?? ""}
                      onChange={(e) => setDetailDraft((prev) => ({ ...(prev ?? {}), nextAction: e.target.value }))}
                    />
                  </Field>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button onClick={handleSaveDetail} className="h-9 px-3 rounded-lg ring-1 ring-neutral-300 text-sm">
                    Save changes
                  </button>
                  <button
                    onClick={() => setDetailId(null)}
                    className="h-9 px-3 rounded-lg ring-1 ring-neutral-300 text-sm"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleDeleteDetail}
                    className="h-9 px-3 rounded-lg ring-1 ring-rose-300 text-sm text-rose-600"
                  >
                    Delete
                  </button>
                </div>

                <div>
                  <div className="text-sm font-semibold mb-1">Matching listings</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {computeMatches(detailDraft as BuyerLeadDoc, listings).map(({ listing, score }) => (
                      <div key={listing.id} className="border border-neutral-200 rounded-lg p-3 bg-neutral-50">
                        <div className="text-sm font-medium truncate">{listing.complex ?? listing.title}</div>
                        <div className="text-xs text-neutral-500">
                          {listing.dong ?? "-"} {listing.ho ?? ""} · {formatKRW(listing.price ?? listing.deposit)}
                        </div>
                        <div className="text-xs text-neutral-400 mt-1">Score {(score * 100).toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t md:border-t-0 md:border-l bg-neutral-50">
                <CommentThread entityType="buyer" entityId={detailId} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
