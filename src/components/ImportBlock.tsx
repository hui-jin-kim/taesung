import React from "react";
import { useScript } from "../lib/useScript";
import { createListing, ListingDoc } from "../lib/listings";
import { useListings, updateListing } from "../state/useListings";
import type { Listing } from "../types/core";

// 간단 CSV 파서 (따옴표, 줄바꿈 대응)
function parseCSV(s: string) {
  const out: string[][] = []; let cur: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else {
      if (ch === '"') q = true;
      else if (ch === ',') { cur.push(cell); cell = ""; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; cur.push(cell); cell = ""; out.push(cur); cur = []; }
      else cell += ch;
    }
  }
  if (cell.length > 0 || cur.length > 0) { cur.push(cell); out.push(cur); }
  if (!out.length) return [] as any[];
  const headers = out[0].map((h) => h.trim());
  return out
    .slice(1)
    .filter((r) => r.some((x) => x && x.trim()))
    .map((r) => { const obj: any = {}; headers.forEach((h, idx) => obj[h] = (r[idx] ?? "").trim()); return obj; });
}

function esc(v: any) { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

export default function ImportBlock() {
  const [text, setText] = React.useState("");
  const [rows, setRows] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string>("");
  const [dragOver, setDragOver] = React.useState(false);
  const { loaded: xlsxLoaded } = useScript("https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js");

  const all = useListings();
  const listings = all as Listing[];
  const byItemNo = React.useMemo(() => {
    const m = new Map<string, string>();
    listings.forEach((listing) => {
      if (listing.itemNo) m.set(String(listing.itemNo), listing.id);
    });
    return m;
  }, [listings]);

  const [failList, setFailList] = React.useState<{ idx: number; itemNo?: string; reason: string }[]>([]);
  const [progress, setProgress] = React.useState<{ done: number; total: number; ok: number; fail: number }>({ done: 0, total: 0, ok: 0, fail: 0 });

  function downloadExcelTemplate() {
    // @ts-ignore
    const XLSX = (window as any).XLSX;
    if (!XLSX) { alert('샘플 라이브러리가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.'); return; }
    const headers = [
      "매물번호","진행상태","구분","매물(단지)명","접수일자","면적","면적옵션","동","호수","매매가","보증금","월세","소유주명","중개사","연락처","메모/비고","담당자","노출(활성)"
    ];
    const sample = [[
      "APT-2510-0001","진행","매매","OO아파트","2025-10-13","34","A",101,1202,950000000,"","","홍길동","MJ부동산","010-1234-5678","확인 메모/유의사항","공동","TRUE"
    ]];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
    XLSX.utils.book_append_sheet(wb, ws, 'template');
    XLSX.writeFile(wb, 'listings_template.xlsx');
  }


  function handlePreview() {
    const t = (text || '').trim();
    const arr = t ? parseCSV(t) : rows;
    setRows(arr);
    setMsg(`미리보기 ${arr.length}건`);
  }

  async function readFile(f: File) {
    const name = f.name.toLowerCase();
    if (name.endsWith('.csv')) {
      alert("현재는 엑셀 파일(.xlsx)만 업로드할 수 있습니다. 엑셀 형식으로 저장한 뒤 다시 시도해 주세요.");
      return;
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      // @ts-ignore
      const XLSX = (window as any).XLSX; if (!XLSX) { alert('엑셀 라이브러리가 로딩 중입니다. 잠시 후 다시 시도해주세요.'); return; }
      const rd = new FileReader();
      rd.onload = () => {
        const data = new Uint8Array(rd.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const arr = XLSX.utils.sheet_to_json(ws, { defval: '' });
        setRows(arr);
        setMsg(`미리보기 ${arr.length}건`);
        setText('');
      };
      rd.readAsArrayBuffer(f);
    }
  }

  function get(obj: any, keys: string[]) { for (const k of keys) { if (obj[k] != null && String(obj[k]).trim() !== '') return obj[k]; } return ''; }
  function num(v: any) { const n = Number(v); return isNaN(n) ? undefined : n; }
  function boolVal(v: any) {
    if (v == null) return undefined;
    const s = String(v).trim().toLowerCase();
    if (!s) return undefined;
    if (["1", "true", "t", "y", "yes", "활성", "on"].includes(s)) return true;
    if (["0", "false", "f", "n", "no", "비활성", "off"].includes(s)) return false;
    return undefined;
  }
  function parseAreaCell(raw: any, suffixRaw?: any) {
    const text = String(raw ?? "").trim();
    const extra = String(suffixRaw ?? "").trim();
    if (!text && !extra) return { value: undefined, suffix: undefined, provided: false };
    const normalized = text.replace(/평$/i, "").trim();
    const match = normalized.match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)?$/);
    let value: number | undefined = undefined;
    let suffix = "";
    if (match) {
      value = Number(match[1]);
      suffix = match[2] ? match[2].toUpperCase() : "";
    } else if (normalized) {
      value = num(normalized);
    }
    if (extra) suffix = extra.toUpperCase();
    return {
      value,
      suffix,
      provided: Boolean(normalized) || Boolean(extra),
    };
  }
  function autoItemNo(idx: number) { const base = new Date().toISOString().slice(2, 7).replace('-', ''); return `APT-${base}-${String(idx + 1).padStart(4, '0')}`; }

  function normalizeText(value: any) {
    if (value == null) return undefined;
    const text = String(value).trim();
    return text ? text : undefined;
  }

  const COMPLETED_KEYWORDS = ["complete", "completed", "\uC644\uB8CC", "\uC885\uB8CC"];
  const OUR_DEAL_KEYWORDS = ["ourdeal", "\uC6B0\uB9AC\uAC70\uB798", "\uC6B0\uB9AC"];
  const PENDING_KEYWORDS = ["pending", "\uB300\uAE30", "\uBCF4\uB958"];
  const ACTIVE_KEYWORDS = ["active", "\uC9C4\uD589", "\uC9C4\uD589\uC911"];

  function normalizeStatus(value: any): Listing["status"] | undefined {
    const text = normalizeText(value);
    if (!text) return undefined;
    const normalized = text.replace(/\s+/g, "").toLowerCase();
    if (COMPLETED_KEYWORDS.includes(normalized)) return "completed";
    if (OUR_DEAL_KEYWORDS.includes(normalized)) return "ourDeal";
    if (PENDING_KEYWORDS.includes(normalized)) return "pending";
    if (ACTIVE_KEYWORDS.includes(normalized)) return "active";
    return text as Listing["status"];
  }

  function normalizeDateValue(value: any) {
    if (value == null || value === "") return undefined;
    if (typeof value === "number" && Number.isFinite(value)) {
      const base = new Date(Date.UTC(1899, 11, 30));
      base.setUTCDate(base.getUTCDate() + Math.floor(value));
      return base.toISOString().slice(0, 10);
    }
    const text = String(value).trim();
    if (!text) return undefined;
    const replaced = text.replace(/[./]/g, "-").replace(/\s+/g, "");
    const match = replaced.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
      const [, y, m, d] = match;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const parsed = Date.parse(text);
    if (!Number.isNaN(parsed)) {
      const date = new Date(parsed);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    return text;
  }

  async function handleImportFirestore() {
    if (!rows.length) return;
    setBusy(true); setFailList([]); setProgress({ done: 0, total: rows.length, ok: 0, fail: 0 });
    let ok = 0, skip = 0; const fails: { idx: number; itemNo?: string; reason: string }[] = [];

    async function processOne(r: any, idx: number) {
      try {
        const itemNo = normalizeText(get(r, ["매물번호", "물건번호", "itemNo"]));
        const status = normalizeStatus(get(r, ["진행상태", "상태", "status"]));
        const type = normalizeText(get(r, ["구분", "거래구분", "type"])) as Listing["type"] | undefined;
        const complex = normalizeText(get(r, ["매물(단지)명", "단지명", "complex"]));
        const receivedAt = normalizeDateValue(get(r, ["접수일자", "등록일", "receivedAt"]));
        const rawArea = get(r, ["면적", "평형", "area_py"]);
        const rawAreaSuffix = get(r, ["면적옵션", "면적 옵션", "area_suffix", "areaSuffix"]);
        const areaInfo = parseAreaCell(rawArea, rawAreaSuffix);
        const area_py = areaInfo.value;
        const areaSuffix = areaInfo.suffix;
        const dong = normalizeText(get(r, ["동", "dong"]));
        const ho = normalizeText(get(r, ["호수", "호", "ho"]));
        const price = num(get(r, ["매매가", "price"]));
        const deposit = num(get(r, ["보증금", "deposit"]));
        const monthly = num(get(r, ["월세", "monthly"]));
        const owner = normalizeText(get(r, ["소유주명", "소유주", "owner"]));
        const agency = normalizeText(get(r, ["중개사", "agency"]));
        const phone = normalizeText(get(r, ["연락처", "전화", "phone"]));
        const memo = normalizeText(get(r, ["메모/비고", "메모", "memo"]));
        const assignee = normalizeText(get(r, ["담당자", "assignee"]));
        const activeRaw = get(r, ["노출(활성)", "노출", "활성", "isActive"]);
        const isActive = boolVal(activeRaw);

        if (itemNo && byItemNo.has(itemNo)) {
          const id = byItemNo.get(itemNo)!;
          const patch: Partial<ListingDoc> = {};
          if (status) patch.status = status;
          if (type) patch.type = type as any;
          if (complex) patch.complex = complex;
          if (receivedAt !== undefined) patch.receivedAt = receivedAt;
          if (areaInfo.provided) {
            if (area_py != null) patch.area_py = area_py;
            patch.areaSuffix = areaSuffix ?? "";
          }
          if (dong) patch.dong = dong;
          if (ho) patch.ho = ho;
          if (price != null) patch.price = price;
          if (deposit != null) patch.deposit = deposit;
          if (monthly != null) patch.monthly = monthly;
          if (owner) patch.owner = owner;
          if (agency) patch.agency = agency;
          if (phone) patch.phone = phone;
          if (memo) patch.memo = memo;
          if (assignee && assignee !== "공동") patch.assigneeName = assignee;
          if (isActive !== undefined) (patch as any).isActive = isActive;
          await updateListing(id, patch);
          ok++;
        } else {
          const titleBase = complex || itemNo || "매물";
          const title = [titleBase, dong, ho].filter(Boolean).join(" ").trim() || "매물";
          const payload: Partial<ListingDoc> & { title: string } = {
            title,
            itemNo: itemNo || autoItemNo(idx - 1),
            status,
            type: type as any,
            complex,
            dong,
            ho,
            area_py,
            areaSuffix: areaInfo.provided ? areaSuffix ?? "" : undefined,
            price,
            deposit,
            monthly,
            owner,
            agency,
            phone,
            memo,
            assigneeName: assignee && assignee !== "공동" ? assignee : undefined,
            receivedAt,
          } as any;
          if (isActive !== undefined) (payload as any).isActive = isActive;
          await createListing(payload);
          ok++;
        }
      } catch (e: any) {
        skip++;
        fails.push({ idx, itemNo: normalizeText(get(r, ["매물번호", "물건번호", "itemNo"])), reason: e?.message || "unknown error" });
      } finally {
        setProgress((p) => ({ ...p, done: Math.min(p.done + 1, p.total), ok, fail: skip }));
      }
    }

    const CHUNK = 25;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      await Promise.all(chunk.map((r, j) => processOne(r, i + j + 2))); // +2: 헤더 고려, 엑셀 행번호 기준
      const done = Math.min(i + CHUNK, rows.length);
      const pct = Math.round((done / rows.length) * 100);
      setMsg(`저장 중... ${done}/${rows.length} (${pct}%)  성공:${ok} 실패:${skip}`);
    }

    setBusy(false);
    setMsg(`저장 완료: 성공 ${ok}, 실패 ${skip}`);
    setFailList(fails);
    const first = fails.slice(0, 5).map(f => `행${f.idx}${f.itemNo ? `(물건번호 ${f.itemNo})` : ''}: ${f.reason}`).join('\n');
    alert(`저장 완료: 총 ${rows.length}건, 성공 ${ok}, 실패 ${skip}${first ? `\n\n예시 오류:\n${first}` : ''}`);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (f) readFile(f); }


  function exportXlsxAll() {
    // @ts-ignore
    const XLSX = (window as any).XLSX; if (!XLSX) { alert('엑셀 라이브러리가 로딩 중입니다. 잠시 후 다시 시도해주세요.'); return; }
    const rowsOut = listings.map((l) => ({
      id: l.id,
      itemNo: l.itemNo || "",
      type: l.type || "",
      complex: l.complex || "",
      dong: l.dong || "",
      ho: l.ho || "",
      area_py: l.area_py ?? "",
      area_suffix: (l as any).areaSuffix ?? "",
      price: l.price || "",
      deposit: l.deposit || "",
      monthly: l.monthly || "",
      owner: l.owner || "",
      agency: l.agency || "",
      phone: l.phone || "",
      memo: l.memo || "",
      assignee: l.assigneeName || "",
      receivedAt: l.receivedAt || "",
    }));
    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(rowsOut); XLSX.utils.book_append_sheet(wb, ws, 'listings'); XLSX.writeFile(wb, 'listings.xlsx');
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input type="file" accept=".xlsx,.xls" onChange={handleFile} />
        <button
          className="h-9 px-3 rounded-lg border border-neutral-200 bg-white text-sm"
          onClick={downloadExcelTemplate}
          disabled={!xlsxLoaded}
          title={xlsxLoaded ? "" : "엑셀 라이브러리를 불러오는 중입니다"}
        >
          엑셀 템플릿
        </button>
        <button className="h-9 px-3 rounded-lg border border-neutral-200 bg-white text-sm" onClick={handlePreview}>
          미리보기
        </button>
        <button
          disabled={busy || rows.length === 0}
          className="h-9 px-3 rounded-lg bg-neutral-900 text-white text-sm disabled:opacity-50"
          onClick={handleImportFirestore}
        >
          {busy ? "저장 중..." : "저장"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        면적 옆 &ldquo;면적옵션&rdquo; 열에 A/B 등 접미사를 입력하면 카드에서 33A평처럼 표시됩니다. (없으면 비워 두세요)
      </p>

      <div
        onDragOver={(e)=>{ e.preventDefault(); setDragOver(true); }}
        onDragLeave={()=>setDragOver(false)}
        onDrop={(e)=>{ e.preventDefault(); setDragOver(false); const dt=e.dataTransfer; if(dt.files && dt.files.length){ readFile(dt.files[0]); } else { const t=dt.getData('text/plain'); if(t){ setText(t); const arr=parseCSV(t); setRows(arr); setMsg(`미리보기 ${arr.length}건`); } } }}
        className={"rounded border " + (dragOver? "border-blue-400 bg-blue-50" : "border-neutral-300")}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="w-full rounded p-2 text-sm outline-none bg-transparent"
          placeholder="엑셀 파일을 드래그하거나 선택해 업로드하세요. (CSV 텍스트를 붙여넣을 수도 있습니다.)"
        />
      </div>
      <div className="text-sm text-neutral-600">{msg}</div>
      {rows.length>0 && (
        <div className="text-xs bg-white rounded-xl ring-1 ring-neutral-200 p-3 max-h-64 overflow-auto">
          {rows.slice(0,20).map((r,idx)=> (
            <div key={idx} className="py-1 border-b last:border-0"><code>{JSON.stringify(r)}</code></div>
          ))}
          {rows.length>20 && <div className="mt-2 text-neutral-400">외 {rows.length-20}건</div>}
        </div>
      )}
      {failList.length>0 && (
        <div className="text-xs bg-white rounded-xl ring-1 ring-rose-200 p-3 max-h-48 overflow-auto">
          <div className="font-semibold text-rose-600 mb-1">실패 {failList.length}건</div>
          {failList.slice(0,20).map((f,i)=> (
            <div key={i} className="py-1 border-b last:border-0">행{f.idx}{f.itemNo?`(물건번호 ${f.itemNo})`:''}: {f.reason}</div>
          ))}
          {failList.length>20 && <div className="mt-2 text-neutral-400">외 {failList.length-20}건</div>}
        </div>
      )}
      {progress.total>0 && busy && (
        <div className="text-xs text-neutral-600">진행률 {Math.round((progress.done/progress.total)*100)}% · {progress.done}/{progress.total} (성공 {progress.ok} / 실패 {progress.fail})</div>
      )}
      <div className="flex items-center gap-2">
        <button
          className="h-9 px-3 rounded-lg border border-neutral-200 bg-white text-sm"
          onClick={exportXlsxAll}
          disabled={!xlsxLoaded}
          title={xlsxLoaded ? "" : "엑셀 라이브러리를 불러오는 중입니다"}
        >
          전체 엑셀 내보내기
        </button>
      </div>
    </div>
  );
}
