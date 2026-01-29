import React from "react";
import type { UserProfile } from "../lib/users";

type BuyerDraft = Record<string, any>;

export default function BuyerForm({
  value,
  onChange,
  users,
  editable = true,
  showPhoneField = true,
  phoneEditable = true,
  complexes = [],
}: {
  value: BuyerDraft;
  onChange: (patch: Partial<BuyerDraft>) => void;
  users: UserProfile[];
  editable?: boolean;
  showPhoneField?: boolean;
  phoneEditable?: boolean;
  complexes?: string[];
}) {
  const [budgetMin, setBudgetMin] = React.useState<string>(value?.budgetMin != null ? String(value.budgetMin) : "");
  const [budgetMax, setBudgetMax] = React.useState<string>(value?.budgetMax != null ? String(value.budgetMax) : "");

  React.useEffect(() => {
    setBudgetMin(value?.budgetMin != null ? String(value.budgetMin) : "");
    setBudgetMax(value?.budgetMax != null ? String(value.budgetMax) : "");
  }, [value?.budgetMin, value?.budgetMax]);

  const invalidBudget = React.useMemo(() => {
    const min = budgetMin ? Number(budgetMin) : undefined;
    const max = budgetMax ? Number(budgetMax) : undefined;
    if (min == null || max == null) return false;
    return min > max;
  }, [budgetMin, budgetMax]);

  const invalidArea = React.useMemo(() => {
    const minA = typeof value?.areaMinPy === "number" ? value.areaMinPy : undefined;
    const maxA = typeof value?.areaMaxPy === "number" ? value.areaMaxPy : undefined;
    if (minA == null || maxA == null) return false;
    return minA > maxA;
  }, [value?.areaMinPy, value?.areaMaxPy]);

  function updateBudget(nextMin: string, nextMax: string) {
    setBudgetMin(nextMin);
    setBudgetMax(nextMax);
    const min = nextMin ? Number(nextMin) : undefined;
    const max = nextMax ? Number(nextMax) : undefined;
    onChange({ budgetMin: min, budgetMax: max });
  }

  const complexPrefsText = (value?.complexPrefs ?? []).join(", ");
  const disabled = !editable;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-neutral-700 mb-1">{"\uC774\uB984"}</label>
          <input
            className="w-full h-9 px-3 rounded-lg border border-neutral-300"
            value={value?.name ?? ""}
            onChange={(e) => onChange({ name: e.target.value })}
            disabled={disabled}
          />
        </div>

        {showPhoneField ? (
          <div>
            <label className="block text-sm text-neutral-700 mb-1">{"\uC5F0\uB77D\uCC98"}</label>
            <input
              className="w-full h-9 px-3 rounded-lg border border-neutral-300"
              value={value?.phone ?? ""}
              onChange={(e) => onChange({ phone: e.target.value })}
              disabled={!phoneEditable}
              placeholder="010-0000-0000"
            />
          </div>
        ) : null}

        {/* 예산 입력은 우측 칼럼(면적 위)으로 이동 */}
      </div>

      <div>
        <div className="text-sm font-semibold text-neutral-700 mb-1">{"\uAC70\uB798 \uC720\uD615"}</div>
        <div className="flex flex-wrap gap-3">
          {(["\uB9E4\uB9E4", "\uC804\uC138", "\uC6D4\uC138"] as const).map((t) => (
            <label key={t} className="inline-flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={(value?.typePrefs ?? []).includes(t)}
                onChange={(e) => {
                  const set = new Set<string>(value?.typePrefs ?? []);
                  if (e.target.checked) set.add(t);
                  else set.delete(t);
                  onChange({ typePrefs: Array.from(set) });
                }}
                disabled={disabled}
              />
              <span>{t}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-neutral-700 mb-1">{"\uD76C\uB9DD \uB2E8\uC9C0"}</label>
          {Array.isArray(complexes) && complexes.length > 0 ? (
            <div className="max-h-36 overflow-auto rounded-lg ring-1 ring-neutral-200 p-2 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {complexes.map((c) => {
                  const checked = (value?.complexPrefs ?? []).includes(c);
                  return (
                    <label key={c} className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(e) => {
                          const set = new Set<string>(value?.complexPrefs ?? []);
                          if (e.target.checked) set.add(c); else set.delete(c);
                          onChange({ complexPrefs: Array.from(set) });
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
          {/* 기타 단지 입력 */}
          <OtherComplexInput
            disabled={disabled}
            selected={(value?.complexPrefs ?? []) as string[]}
            onAdd={(names) => {
              const set = new Set<string>(value?.complexPrefs ?? []);
              names.forEach((n) => set.add(n));
              onChange({ complexPrefs: Array.from(set) });
            }}
          />
        </div>
        <div>
          <label className="block text-sm text-neutral-700 mb-1">{"\uC608\uC0B0(\uB9CC\uC6D0)"}</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="w-full h-9 px-3 rounded-lg border border-neutral-300"
              value={budgetMin}
              onChange={(e) => updateBudget(e.target.value.replace(/[^0-9]/g, ""), budgetMax)}
              inputMode="numeric"
              placeholder="min"
              disabled={disabled}
            />
            <input
              className="w-full h-9 px-3 rounded-lg border border-neutral-300"
              value={budgetMax}
              onChange={(e) => updateBudget(budgetMin, e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="max"
              disabled={disabled}
            />
          </div>
          {invalidBudget ? (
            <div className="text-[12px] text-red-600 mt-1">{"\uBBF8\uB2EC\uC758 \uAC12\uC740 \uCD5C\uB300\uAC12\uBCF4\uB2E4 \uC791\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."}</div>
          ) : null}

          <label className="block text-sm text-neutral-700 mb-1">{"\uD76C\uB9DD \uBA74\uC801 \uBC94\uC704(\uD3C9)"}</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="w-full h-9 px-3 rounded-lg border border-neutral-300"
              value={value?.areaMinPy ?? ""}
              onChange={(e) => onChange({ areaMinPy: e.target.value ? Number(e.target.value.replace(/[^0-9]/g, "")) : undefined })}
              inputMode="numeric"
              placeholder="min"
              disabled={disabled}
            />
            <input
              className="w-full h-9 px-3 rounded-lg border border-neutral-300"
              value={value?.areaMaxPy ?? ""}
              onChange={(e) => onChange({ areaMaxPy: e.target.value ? Number(e.target.value.replace(/[^0-9]/g, "")) : undefined })}
              inputMode="numeric"
              placeholder="max"
              disabled={disabled}
            />
          </div>
          {invalidArea ? (
            <div className="text-[12px] text-red-600 mt-1">{"\uBA74\uC801 \uCD5C\uC18C\uAC12\uC740 \uCD5C\uB300\uAC12\uBCF4\uB2E4 \uC791\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."}</div>
          ) : null}
        </div>
      </div>

      <div>
        <label className="block text-sm text-neutral-700 mb-1">{"\uB2F4\uB2F9\uC790"}</label>
        {(() => {
          const valueKey = value?.assignedTo ?? "";
          const hasMatch = users.some((u) => u.uid === valueKey);
          return (
            <select
              value={valueKey}
              onChange={(e) => onChange({ assignedTo: e.target.value || undefined })}
              className="w-full h-9 px-3 rounded-lg border border-neutral-300"
              disabled={disabled}
            >
              <option value="">{"\uBBF8\uC9C0\uC815"}</option>
              {!hasMatch && valueKey ? <option value={valueKey}>{`\uAE30\uC874: ${valueKey}`}</option> : null}
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          );
        })()}
      </div>

      <div>
        <label className="block text-sm text-neutral-700 mb-1">{"\uBA54\uBAA8"}</label>
        <textarea
          className="w-full min-h-[100px] px-3 py-2 rounded-lg border border-neutral-300"
          value={value?.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          disabled={disabled}
          placeholder={"\uCD94\uAC00 \uC815\uBCF4\uB97C \uC785\uB825\uD558\uC138\uC694."}
        />
      </div>
    </div>
  );
}

function OtherComplexInput({ disabled, selected, onAdd }: { disabled: boolean; selected: string[]; onAdd: (names: string[]) => void }) {
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
          disabled={disabled}
        />
        <button type="button" onClick={commit} disabled={disabled || !text.trim()} className="h-9 px-3 rounded-lg bg-white ring-1 ring-neutral-300 text-sm disabled:opacity-50">{"\uCD94\uAC00"}</button>
      </div>
      {selected.length > 0 ? (
        <div className="mt-1 text-[12px] text-neutral-600">{"\uC120\uD0DD: "}{selected.join(', ')}</div>
      ) : null}
    </div>
  );
}
