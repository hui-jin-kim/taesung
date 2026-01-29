import React, { createContext, useContext, useMemo, useState } from "react";

export type Listing = {
  id: string;
  title: string;
  complex: string;
  dong: string;
  type: "전세" | "월세" | "매매";
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
  };
};

/** 초기 샘플: 기존 Listings.tsx의 SAMPLE_LISTINGS 값을 그대로 옮김 */
const INITIAL_LIST: Listing[] = [
  {
    id: "mz-102-2500",
    title: "메이플자이 102동 전세 25억",
    complex: "메이플자이",
    dong: "102동",
    type: "전세",
    price: 2500000000,
    address: "서울 서초구 잠원동",
    area_m2: 165.41,
    area_py: 50,
    floor: "12/28층",
    orientation: "남향",
    imageUrl: "https://placehold.co/640x420?text=MAPLE+JAI+102",
    summary: ["메이플상가 1단지 인접", "초품아(신동초)"],
    contact: "매광공인중개사 02-0000-0000",
    tags: ["메이플자이", "전세", "33평"],
    detail: {
      year: 2025,
      heating: "개별난방",
      parking: "세대당 1대",
      description: "넓은 판상형 구조, 보조주방/팬트리, 드레스룸 2개",
      floorplanUrl: "https://placehold.co/1200x800?text=FLOORPLAN",
    },
  },
  {
    id: "mz-102-2900",
    title: "메이플자이 102동 전세 29억",
    complex: "메이플자이",
    dong: "102동",
    type: "전세",
    price: 2900000000,
    address: "서울 서초구 잠원동",
    area_m2: 165.41,
    area_py: 50,
    floor: "12/28층",
    orientation: "남향",
    imageUrl: "https://placehold.co/640x420?text=MAPLE+JAI+102",
    summary: ["정남향 채광", "입주 즉시 가능"],
    contact: "매광공인중개사 02-0000-0000",
    tags: ["메이플자이", "전세", "33평"],
    detail: {
      year: 2025,
      heating: "개별난방",
      parking: "세대당 1대",
      description: "확장형 거실, 시스템 에어컨 4대",
      floorplanUrl: "https://placehold.co/1200x800?text=FLOORPLAN",
    },
  },
  {
    id: "k5-290",
    title: "논현 K5 빌딩 매매 290억",
    complex: "K5 빌딩",
    dong: "-",
    type: "매매",
    price: 29000000000,
    address: "서울 강남구 논현동 143-1",
    area_m2: 1067.97,
    area_py: 323.06,
    floor: "B1~6F",
    orientation: "도로변 코너 6m/3m",
    imageUrl: "https://placehold.co/640x420?text=K5+BUILDING",
    summary: ["논현역 도보 1분", "5년차 신축", "수익률 1.93%"],
    contact: "메이플자이공인중개사 02-532-8869",
    tags: ["상업", "빌딩", "논현"],
    detail: {
      year: 2020,
      heating: "개별냉난방",
      parking: "법정 8대 / 실치 8대",
      description: "내부 계단으로 층연결, 층별 독립 임대",
      floorplanUrl: "https://placehold.co/1200x800?text=FLOORPLAN",
    },
  },
];

type Ctx = {
  listings: Listing[];
  addListing: (l: Listing) => void;
  updateListing: (id: string, patch: Partial<Listing>) => void;
  removeListing: (id: string) => void;
};

const ListingsContext = createContext<Ctx | null>(null);

export const ListingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [listings, setListings] = useState<Listing[]>(INITIAL_LIST);

  const addListing: Ctx["addListing"] = (l) => setListings((prev) => [l, ...prev]);
  const updateListing: Ctx["updateListing"] = (id, patch) =>
    setListings((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeListing: Ctx["removeListing"] = (id) =>
    setListings((prev) => prev.filter((x) => x.id !== id));

  const value = useMemo(() => ({ listings, addListing, updateListing, removeListing }), [listings]);

  return <ListingsContext.Provider value={value}>{children}</ListingsContext.Provider>;
};

export function useListings() {
  const ctx = useContext(ListingsContext);
  if (!ctx) throw new Error("useListings must be used within ListingsProvider");
  return ctx;
}
