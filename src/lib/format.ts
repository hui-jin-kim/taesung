// src/lib/format.ts
// 금액 표기 단위: '만원' 기준으로 그대로 표시합니다.
// 예) 100000 -> "100,000만원"
export function formatKRW(n?: number) {
  if (n == null || !isFinite(n)) return "-";
  return `${n.toLocaleString("ko-KR")}만원`;
}

export function formatAreaPy(area?: number, suffix?: string, withUnit = true) {
  if (area == null || !isFinite(area)) return "-";
  const suffixText = suffix ? String(suffix) : "";
  return withUnit ? `${area}${suffixText}평` : `${area}${suffixText}`;
}

export function mergeAreaSuffix(primary?: string, extra?: string) {
  const parts: string[] = [];
  if (primary) parts.push(String(primary));
  if (extra) parts.push(String(extra));
  return parts.join("");
}

export function formatTimestamp(value: any, includeTime = true) {
  if (!value) return "";
  let date: Date | null = null;
  if (typeof value === "number") {
    date = new Date(value);
  } else if (typeof value === "string") {
    date = new Date(value);
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "object") {
    if (typeof (value as any).toDate === "function") {
      date = (value as any).toDate();
    } else if ((value as any).seconds != null) {
      const seconds = (value as any).seconds;
      const nanos = (value as any).nanoseconds ?? 0;
      date = new Date(seconds * 1000 + Math.floor(nanos / 1_000_000));
    }
  }
  if (!date || Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  if (!includeTime) return `${yyyy}-${mm}-${dd}`;
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
