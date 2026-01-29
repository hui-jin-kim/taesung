import React from "react";

type ChipsInputProps<T = string | number> = {
  value: T[];
  onChange: (next: T[]) => void;
  placeholder?: string;
  parse?: "string" | "number"; // 입력값을 숫자로 변환할지 여부
  className?: string;
};

function normalizeToken(raw: string, parse: "string" | "number") {
  const t = raw.trim();
  if (!t) return undefined as any;
  if (parse === "number") {
    const n = Number(t.replace(/,/g, ""));
    return Number.isFinite(n) ? (n as any) : undefined;
  }
  return t as any;
}

export default function ChipsInput<T = string | number>({ value, onChange, placeholder, parse = "string", className = "" }: ChipsInputProps<T>) {
  const [draft, setDraft] = React.useState("");
  const ref = React.useRef<HTMLInputElement | null>(null);

  function commitToken(token: string) {
    const v = normalizeToken(token, parse) as any as T | undefined;
    if (v === undefined || v === null || v === ("" as any)) return;
    const exists = (value as any[]).some((x) => String(x) === String(v));
    if (exists) return;
    onChange([...(value as any[]), v] as any);
    setDraft("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitToken(draft);
    } else if (e.key === "Backspace" && !draft) {
      onChange((value as any[]).slice(0, -1) as any);
    }
  }

  function removeAt(idx: number) {
    const next = (value as any[]).filter((_, i) => i !== idx) as any;
    onChange(next);
  }

  return (
    <div className={`w-full border rounded px-2 py-1 text-sm bg-white min-h-[38px] flex items-center flex-wrap gap-1 ${className}`} onClick={() => ref.current?.focus()}>
      {(value as any[]).map((chip, idx) => (
        <span key={`${idx}-${chip}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 ring-1 ring-neutral-200">
          <span>{String(chip)}</span>
          <button type="button" className="text-neutral-500 hover:text-neutral-700" onClick={() => removeAt(idx)} aria-label="remove">
            ×
          </button>
        </span>
      ))}
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="flex-1 min-w-[120px] outline-none px-1 py-1"
      />
    </div>
  );
}

