import React, { useMemo, useState } from "react";
import { useSettings } from "../context/SettingsContext";

export default function AgentsBlock() {
  const { settings, updateSettings } = useSettings();
  const [text, setText] = useState<string>(() => (settings.agents || ["공동"]).join("\n"));

  const normalized = useMemo(() => {
    const arr = Array.from(new Set(text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)));
    if (!arr.includes("공동")) arr.unshift("공동");
    return arr;
  }, [text]);

  function save() {
    updateSettings({ agents: normalized });
    alert("담당자 목록을 저장했습니다.");
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-neutral-600">담당자 프리셋을 줄바꿈으로 입력하세요. '공동'은 항상 포함됩니다.</div>
      <textarea value={text} onChange={(e)=>setText(e.target.value)} rows={6} className="w-full border rounded p-2 text-sm" />
      <div className="flex items-center gap-2">
        <button className="h-9 px-3 rounded-lg bg-neutral-900 text-white text-sm" onClick={save}>저장</button>
        <span className="text-xs text-neutral-500">미리보기: {normalized.join(", ")}</span>
      </div>
    </div>
  );
}

