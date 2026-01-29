import React from "react";
import { createBuyer } from "../state/useBuyers";
import { listUserProfiles, type UserProfile } from "../lib/users";
import BuyerForm from "./BuyerForm";
import { useListings } from "../state/useListings";
import { useAuth } from "../context/AuthContext";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
  prefill?: {
    name?: string;
    phone?: string;
    notes?: string;
    ownerName?: string;
  };
};

export default function BuyerNewSheet({ open, onClose, onCreated, prefill }: Props) {
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [draft, setDraft] = React.useState<Record<string, any>>({
    name: "",
    phone: "",
    budgetMin: undefined,
    budgetMax: undefined,
    monthlyMax: undefined,
    notes: "",
    ownerName: "",
    typePrefs: [],
    complexPrefs: [],
    areaPrefsPy: [],
    assignedTo: undefined,
    receivedDate: new Date().toISOString().slice(0, 10),
  });

  const { user } = useAuth();

  React.useEffect(() => {
    if (open) {
      setDraft({
        name: prefill?.name ?? "",
        phone: prefill?.phone ?? "",
        budgetMin: undefined,
        budgetMax: undefined,
        monthlyMax: undefined,
        notes: prefill?.notes ?? "",
        ownerName: prefill?.ownerName ?? "",
        typePrefs: [],
        complexPrefs: [],
        areaPrefsPy: [],
        assignedTo: user?.uid ?? undefined,
        receivedDate: new Date().toISOString().slice(0, 10),
      });
      setError("");
      setSaving(false);
    }
  }, [open, user?.uid, prefill?.name, prefill?.phone, prefill?.notes, prefill?.ownerName]);

  React.useEffect(() => {
    listUserProfiles()
      .then((all) => setUsers(all.filter((u) => u.role === "owner" || u.role === "admin" || u.role === "staff")))
      .catch(() => {});
  }, []);

  // Build complexes suggestions from listings (hooks must be before any return)
  const listings = useListings?.() as any[] | undefined;
  const complexOptions = React.useMemo(() => {
    const s = new Set<string>();
    (listings ?? []).forEach((l: any) => { if (l?.complex) s.add(String(l.complex)); });
    return Array.from(s).sort();
  }, [listings]);

  if (!open) return null;

  async function handleSave() {
    const name = String(draft.name || "").trim();
    if (!name) {
      setError("\uC774\uB984\uC744 \uC785\uB825\uD558\uC138\uC694.");
      return;
    }
    if (typeof draft.areaMinPy === "number" && typeof draft.areaMaxPy === "number" && draft.areaMinPy > draft.areaMaxPy) {
      setError("\uBA74\uC801 \uCD5C\uC18C\uAC12\uC740 \uCD5C\uB300\uAC12\uBCF4\uB2E4 \uC791\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    if (draft.budgetMin != null && draft.budgetMax != null && Number(draft.budgetMin) > Number(draft.budgetMax)) {
      setError("\uC608\uC0B0 \uCD5C\uC18C\uAC12\uC740 \uCD5C\uB300\uAC12\uBCF4\uB2E4 \uC791\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const wantsMonthly = (draft.typePrefs ?? []).includes("\uC6D4\uC138");
      const monthlyValue = wantsMonthly && draft.monthlyMax ? Number(draft.monthlyMax) : undefined;
      const assignedUid = draft.assignedTo || user?.uid || undefined;
      const assignedProfile = users.find((u) => u.uid === assignedUid);
      const assignedName = assignedProfile?.name || assignedProfile?.email || undefined;
      const assignedEmail = assignedProfile?.email || undefined;
        const id = await createBuyer({
          name,
          phone: String(draft.phone || "").trim() || undefined,
          ownerName: String(draft.ownerName || "").trim() || undefined,
          budgetMin: draft.budgetMin != null ? Number(draft.budgetMin) : undefined,
          budgetMax: draft.budgetMax != null ? Number(draft.budgetMax) : undefined,
          monthlyMax: monthlyValue,
        notes: String(draft.notes || "").trim() || undefined,
        typePrefs: draft.typePrefs ?? [],
        complexPrefs: (draft.complexPrefs ?? []).filter(Boolean),
        areaPrefsPy: (draft.areaPrefsPy ?? []).map((v: any) => Number(v)).filter((n: any) => Number.isFinite(n)),
        areaMinPy: typeof draft.areaMinPy === "number" ? draft.areaMinPy : undefined,
        areaMaxPy: typeof draft.areaMaxPy === "number" ? draft.areaMaxPy : undefined,
        assignedTo: assignedUid,
        assignedToName: assignedName,
        assignedToEmail: assignedEmail,
        receivedDate: String(draft.receivedDate || new Date().toISOString().slice(0,10)),
      } as any);
      if (onCreated) onCreated(id);
      onClose();
    } catch {
      setError("\uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-bold">{"\uC2E0\uADDC \uB9E4\uC218\uC790"}</h3>

          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          {/* 湲곕낯 ?뺣낫 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-neutral-700 mb-1">{"\uC774\uB984"}</label>
              <input
                className="w-full h-9 px-3 rounded-lg border border-neutral-300"
                value={draft.name}
                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-700 mb-1">{"\uC18C\uC720\uC790\uB0B4"}</label>
              <input
                className="w-full h-9 px-3 rounded-lg border border-neutral-300"
                value={draft.ownerName}
                onChange={(e) => setDraft((p) => ({ ...p, ownerName: e.target.value }))}
                placeholder="소유자 이름"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-700 mb-1">{"\uC5F0\uB77D\uCC98"}</label>
              <input
                inputMode="tel"
                className="w-full h-9 px-3 rounded-lg border border-neutral-300"
                value={draft.phone}
                onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
                placeholder="010-0000-0000"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-neutral-700 mb-1">접수일자</label>
              <input
                type="date"
                className="w-full h-9 px-3 rounded-lg border border-neutral-300"
                value={draft.receivedDate || new Date().toISOString().slice(0,10)}
                onChange={(e) => setDraft((p) => ({ ...p, receivedDate: e.target.value }))}
              />
            </div>
          </div>

          {/* 醫? ?좏삎/?덉궛/硫댁쟻/?대떦??| ?? ?щ쭩?⑥?/湲고?異붽? */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-neutral-700 mb-1">{"\uAC70\uB798 \uC720\uD615"}</div>
                <div className="flex flex-wrap gap-3">
                  {(["\uB9E4\uB9E4", "\uC804\uC138", "\uC6D4\uC138"] as const).map((t) => (
                    <label key={t} className="inline-flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={(draft.typePrefs ?? []).includes(t)}
                        onChange={(e) => {
                          const set = new Set<string>(draft.typePrefs ?? []);
                          if (e.target.checked) set.add(t);
                          else set.delete(t);
                          const next = Array.from(set);
                          setDraft((p) => ({
                            ...p,
                            typePrefs: next,
                            monthlyMax: next.includes("\uC6D4\uC138") ? p.monthlyMax : undefined,
                          }));
                        }}
                      />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
              <label className="block text-sm text-neutral-700 mb-1">{"\uC608\uC0B0(\uB9CC\uC6D0)"}</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="w-full h-9 px-3 rounded-lg border border-neutral-300"
                  value={draft.budgetMin ?? ""}
                    onChange={(e) => setDraft((p) => ({ ...p, budgetMin: e.target.value.replace(/[^0-9]/g, "") }))}
                    inputMode="numeric"
                    placeholder="min"
                  />
                  <input
                    className="w-full h-9 px-3 rounded-lg border border-neutral-300"
                    value={draft.budgetMax ?? ""}
                    onChange={(e) => setDraft((p) => ({ ...p, budgetMax: e.target.value.replace(/[^0-9]/g, "") }))}
                    inputMode="numeric"
                  placeholder="max"
                />
              </div>
              {(draft.typePrefs ?? []).includes("\uC6D4\uC138") ? (
                <div className="mt-2">
                  <label className="block text-sm text-neutral-700 mb-1">{"\uC6D4\uC138 \uD55C\uB3C4(\uB9CC\uC6D0)"}</label>
                  <input
                    className="w-full h-9 px-3 rounded-lg border border-neutral-300"
                    value={draft.monthlyMax ?? ""}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        monthlyMax: e.target.value.replace(/[^0-9]/g, ""),
                      }))
                    }
                    inputMode="numeric"
                    placeholder="max"
                  />
                </div>
              ) : null}
            </div>

              <div>
                <label className="block text-sm text-neutral-700 mb-1">{"\uD76C\uB9DD \uBA74\uC801 \uBC94\uC704(\uD3C9)"}</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="w-full h-9 px-3 rounded-lg border border-neutral-300"
                    value={draft.areaMinPy ?? ""}
                    onChange={(e) => setDraft((p) => ({ ...p, areaMinPy: e.target.value ? Number(e.target.value.replace(/[^0-9]/g, "")) : undefined }))}
                    inputMode="numeric"
                    placeholder="min"
                  />
                  <input
                    className="w-full h-9 px-3 rounded-lg border border-neutral-300"
                    value={draft.areaMaxPy ?? ""}
                    onChange={(e) => setDraft((p) => ({ ...p, areaMaxPy: e.target.value ? Number(e.target.value.replace(/[^0-9]/g, "")) : undefined }))}
                    inputMode="numeric"
                    placeholder="max"
                  />
                </div>
              </div>

            <div>
              <label className="block text-sm text-neutral-700 mb-1">{"\uB2F4\uB2F9\uC790"}</label>
              {(() => {
                const value = draft.assignedTo ?? "";
                const hasMatch = users.some((u) => u.uid === value);
                return (
                  <select
                    value={value}
                    onChange={(e) => setDraft((p) => ({ ...p, assignedTo: e.target.value || undefined }))}
                    className="w-full h-9 px-3 rounded-lg border border-neutral-300"
                  >
                    <option value="">{"\uBBF8\uC9C0\uC815"}</option>
                    {!hasMatch && value ? (
                      <option value={value}>{`\uAE30\uC874: ${value}`}</option>
                    ) : null}
                    {users.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                );
              })()}
            </div>
            </div>

            {/* ?곗륫 */}
            <div>
              <label className="block text-sm text-neutral-700 mb-1">{"\uD76C\uB9DD \uB2E8\uC9C0"}</label>
              {Array.isArray(complexOptions) && complexOptions.length > 0 ? (
                <div className="max-h-36 overflow-auto rounded-lg ring-1 ring-neutral-200 p-2 bg-white">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {complexOptions.map((c) => {
                      const checked = (draft.complexPrefs ?? []).includes(c);
                      return (
                        <label key={c} className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const set = new Set<string>(draft.complexPrefs ?? []);
                              if (e.target.checked) set.add(c); else set.delete(c);
                              setDraft((p) => ({ ...p, complexPrefs: Array.from(set) }));
                            }}
                          />
                          <span className="truncate" title={c}>{c}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-[12px] text-neutral-500">{"\uB4F1\uB85D\uB41C \uB2E8\uC9C0 \uBAA9\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."}</div>
              )}

              <OtherComplexInputInline
                selected={(draft.complexPrefs ?? []) as string[]}
                onAdd={(names) => {
                  const set = new Set<string>(draft.complexPrefs ?? []);
                  names.forEach((n) => set.add(n));
                  setDraft((p) => ({ ...p, complexPrefs: Array.from(set) }));
                }}
              />
            </div>
          </div>

          {/* 硫붾え */}
          <div>
            <label className="block text-sm text-neutral-700 mb-1">{"\uBA54\uBAA8"}</label>
            <textarea
              className="w-full min-h-[100px] px-3 py-2 rounded-lg border border-neutral-300"
              value={draft.notes}
              onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
              placeholder={"\uCD94\uAC00 \uC815\uBCF4\uB97C \uC785\uB825\uD558\uC138\uC694."}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={saving} className="h-9 px-4 rounded-lg bg-neutral-900 text-white text-sm disabled:opacity-50">{saving ? "\uC800\uC7A5 \uC911..." : "\uC800\uC7A5"}</button>
            <button onClick={onClose} className="h-9 px-3 rounded-lg ring-1 ring-neutral-300 text-sm">{"\uB2EB\uAE30"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OtherComplexInputInline({ selected, onAdd }: { selected: string[]; onAdd: (names: string[]) => void }) {
  const [text, setText] = React.useState("");
  function commit() {
    const parts = text
      .split(/\s*,\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !selected.includes(s));
    if (parts.length > 0) onAdd(parts);
    setText("");
  }
  return (
    <div className="mt-2">
      <label className="block text-[12px] text-neutral-500 mb-1">{"\uAE30\uD0C0 \uB2E8\uC9C0 \uCD94\uAC00(, \uAD6C\uBD84)"}</label>
      <div className="flex gap-2">
        <input
          className="flex-1 h-9 px-3 rounded-lg border border-neutral-300"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
          placeholder={"\uB2E8\uC9C0A, \uB2E8\uC9C0B"}
        />
        <button type="button" onClick={commit} disabled={!text.trim()} className="h-9 px-3 rounded-lg bg-white ring-1 ring-neutral-300 text-sm disabled:opacity-50">{"\uCD94\uAC00"}</button>
      </div>
      {selected.length > 0 ? (
        <div className="mt-1 text-[12px] text-neutral-600">{"\uC120\uD0DD: "}{selected.join(', ')}</div>
      ) : null}
    </div>
  );
}



