import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import type { Listing } from "../types/core";
import type { Buyer } from "../types/buyer";

type TimestampLike =
  | { toMillis: () => number }
  | { seconds: number; nanoseconds: number }
  | number
  | string
  | null
  | undefined;

function toMillis(value: TimestampLike): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  try {
    if (typeof (value as any).toMillis === "function") {
      return (value as any).toMillis();
    }
    const v = value as { seconds: number; nanoseconds: number };
    if (typeof v.seconds === "number") {
      return Math.floor(v.seconds * 1000 + (v.nanoseconds || 0) / 1e6);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function formatDate(value: TimestampLike): string {
  const ms = toMillis(value);
  if (!ms) return "";
  try {
    const date = new Date(ms);
    if (!Number.isFinite(date.getTime())) return "";
    return date.toISOString();
  } catch {
    return "";
  }
}

function escapeCsv(value: unknown): string {
  if (value == null) return "";
  const text = String(value);
  if (text.includes('"') || text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const BOM = "\ufeff";
  const lines = [header.map(escapeCsv).join(",")];
  rows.forEach((row) => lines.push(row.map(escapeCsv).join(",")));
  const blob = new Blob([BOM + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function normalizeArray(value?: Array<string | number>, suffix?: string): string {
  if (!value || value.length === 0) return "";
  return value
    .map((item) => `${item}${suffix ?? ""}`.trim())
    .filter(Boolean)
    .join(" / ");
}

function normalizeTypePrefs(value?: Array<string>): string {
  if (!value || value.length === 0) return "";
  return value.join(", ");
}

function boolOrEmpty(value: unknown): string {
  if (value === true) return "Y";
  if (value === false) return "N";
  return "";
}

export async function exportListingsCsv(options?: { complex?: string }) {
  const constraints = [];
  if (options?.complex) {
    constraints.push(where("complex", "==", options.complex));
  }
  const ref = collection(db, "listings");
  const snap = await getDocs(constraints.length ? query(ref, ...constraints) : ref);
  const rows: Listing[] = [];
  snap.forEach((doc) => {
    rows.push({ id: doc.id, ...(doc.data() as any) });
  });

  const header = [
    "ID",
    "제목",
    "상태",
    "단지",
    "동",
    "호",
    "전용면적(평)",
    "매매가(만원)",
    "보증금(만원)",
    "월세(만원)",
    "담당자",
    "소유주",
    "연락처",
    "메모",
    "키워드",
    "우리거래여부",
    "등록일",
    "수정일",
  ];

  const body = rows.map((item) =>
    [
      item.id ?? "",
      item.title ?? "",
      item.status ?? "",
      item.complex ?? "",
      item.dong ?? "",
      item.ho ?? "",
      item.area_py != null ? `${item.area_py}${(item as any).areaSuffix ?? ""}` : "",
      item.price ?? "",
      item.deposit ?? "",
      item.monthly ?? "",
      item.assigneeName ?? "",
      item.owner ?? "",
      item.phone ?? "",
      item.memo ?? "",
      normalizeArray(item.keywords as any[]),
      boolOrEmpty(item.closedByUs),
      formatDate((item as any)?.createdAt),
      formatDate((item as any)?.updatedAt),
    ].map((value) => (value == null ? "" : String(value)))
  );

  const filename = options?.complex
    ? `listings_${options.complex}_${new Date().toISOString()}.csv`
    : `listings_${new Date().toISOString()}.csv`;
  downloadCsv(filename, header, body);
}

export async function exportBuyersCsv() {
  const ref = collection(db, "buyers");
  const snap = await getDocs(ref);
  const rows: Buyer[] = [];
  snap.forEach((doc) => {
    rows.push({ id: doc.id, ...(doc.data() as any) });
  });

  const header = [
    "ID",
    "이름",
    "연락처",
    "예산 최소(만원)",
    "예산 최대(만원)",
    "거래유형",
    "선호 단지",
    "선호 면적(평)",
    "필수 조건",
    "담당자",
    "메모",
    "최근 코멘트",
    "등록일",
    "수정일",
  ];

  const body = rows.map((item) =>
    [
      item.id ?? "",
      item.name ?? "",
      item.phone ?? "",
      item.budgetMin ?? "",
      item.budgetMax ?? "",
      normalizeTypePrefs(item.typePrefs),
      normalizeArray(item.complexPrefs),
      normalizeArray(item.areaPrefsPy, "평"),
      normalizeArray(item.mustHaves),
      item.assignedTo ?? "",
      item.notes ?? "",
      item.lastCommentText ?? "",
      formatDate((item as any)?.createdAt),
      formatDate((item as any)?.updatedAt),
    ].map((value) => (value == null ? "" : String(value)))
  );

  const filename = `buyers_${new Date().toISOString()}.csv`;
  downloadCsv(filename, header, body);
}
