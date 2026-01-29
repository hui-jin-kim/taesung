// Shared listing types
export type ListingCategory = "APT" | "OFS" | "SHP" | "BLD" | "LND";
// Keep status as generic string to avoid encoding mismatches in legacy data
export type ListingStatus = string;

export type Listing = {
  id: string;
  category: ListingCategory;
  status: ListingStatus;
  title: string;
  complex: string;
  dong: string;
  ho?: string;
  type: string; // e.g., "전세" | "월세" | "매매"
  price: number;
  deposit?: number;
  address: string;
  area_m2: number;
  area_py: number;
  areaSuffix?: string;
  floor?: string;
  orientation?: string;
  imageUrl: string;
  summary: string[];
  contact: string;
  tags?: string[];
  detail?: {
    year?: number;
    heating?: string;
    parking?: string;
    description?: string;
    floorplanUrl?: string;
    // Extended optional fields for richer data capture
    usage?: string; // 건축물용도
    supply_m2?: number; // 공급면적
    net_m2?: number; // 전용면적
    net_ratio_pct?: number; // 전용율(%)
    direction_base?: string; // 방향 기준
    entrance?: string; // 현관구조
    rooms?: number;
    baths?: number;
    build_date?: { type?: string; year?: number; month?: number; day?: number };
    mortgage?: { amount?: number; ratio?: string };
    monthly?: number; // 월세
    maintain_fee?: number; // 관리비(원)
    move_in?: { type: "즉시입주" | "날짜" | "협의"; date?: string };
    parking_total?: number;
    household_total?: number;
    parking_per_house?: number;
    features?: string; // 매물특징 요약(키워드)
    summary_line?: string; // 리스트 노출 문구(40자)
    photos?: string[]; // 이미지 URL 리스트
    agent_memo?: string; // 비공개 메모
    contact_office?: string; // 중개업소 대표전화
    contact_mobile?: string; // 휴대전화
    contact_display?: "둘다" | "대표만" | "휴대폰만";
    region1?: string; // 시/도
    region2?: string; // 시/군/구
    region3?: string; // 읍/면/동
    assignee?: string; // 담당자 (미지정시 '공동')
  };
};
