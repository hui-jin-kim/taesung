import type { MatchBuyer, MatchListing, MatchEntry } from "../types/match";
export type { MatchEntry };

type NormalizedType = "매매" | "전세" | "월세";

function normalizeType(value?: string | null): NormalizedType | undefined {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return undefined;
  if (text.includes("매매") || text.includes("sale")) return "매매";
  if (text.includes("전세") || text.includes("jeonse")) return "전세";
  if (text.includes("월세") || text.includes("rent")) return "월세";
  return undefined;
}

function resolveListingPrice(type: NormalizedType | undefined, listing: MatchListing): number | undefined {
  if (!type) return undefined;
  if (type === "매매") return listing.price ?? undefined;
  if (type === "전세") return listing.deposit ?? listing.price ?? undefined;
  return listing.monthly ?? listing.deposit ?? listing.price ?? undefined;
}

function buyerAllowsType(buyer: MatchBuyer, type: NormalizedType | undefined): boolean {
  if (!type) return false;
  if (!buyer.typePrefs || buyer.typePrefs.length === 0) return true;
  return buyer.typePrefs.some((pref) => normalizeType(pref) === type);
}

function buyerAllowsArea(buyer: MatchBuyer, area?: number): boolean {
  if (area == null) return true;
  const { areaMinPy, areaMaxPy } = buyer;
  if (typeof areaMinPy === "number" && area < areaMinPy) return false;
  if (typeof areaMaxPy === "number" && area > areaMaxPy) return false;
  if (Array.isArray(buyer.areaPrefsPy) && buyer.areaPrefsPy.length > 0) {
    return buyer.areaPrefsPy.some((preferred) => Math.abs(preferred - area) <= 1);
  }
  return true;
}

function buyerAllowsPrice(
  buyer: MatchBuyer,
  listing: MatchListing,
  listingType: NormalizedType | undefined,
  price?: number
): boolean {
  if (price == null) return true;
  if (typeof buyer.budgetMin === "number" && price < buyer.budgetMin) return false;
  if (typeof buyer.budgetMax === "number" && price > buyer.budgetMax) return false;

  if (listingType === "월세") {
    const monthly = listing.monthly ?? price;
    if (typeof buyer.monthlyMax === "number" && monthly > buyer.monthlyMax) return false;
  }
  return true;
}

function basicMatch(buyer: MatchBuyer, listing: MatchListing): boolean {
  if (listing.deletedAt && listing.deletedAt > 0) return false;
  const statusText = String(listing.status ?? "").toLowerCase();
  if (statusText.includes("삭제") || statusText.includes("완료") || statusText.includes("종료")) return false;

  const type = normalizeType(listing.type);
  if (!buyerAllowsType(buyer, type)) return false;

  const area = typeof listing.area_py === "number" ? listing.area_py : undefined;
  if (!buyerAllowsArea(buyer, area)) return false;

  const price = resolveListingPrice(type, listing);
  if (!buyerAllowsPrice(buyer, listing, type, price)) return false;

  return true;
}

export function calcMatchScore(buyer: MatchBuyer, listing: MatchListing): number {
  if (!basicMatch(buyer, listing)) return 0;
  let score = 0;
  score += normalizeType(listing.type) ? 1 : 0;
  score += typeof listing.area_py === "number" ? 1 : 0;
  score += resolveListingPrice(normalizeType(listing.type), listing) != null ? 1 : 0;
  return score || 1;
}

function isStrictMatch(buyer: MatchBuyer, listing: MatchListing): boolean {
  const type = normalizeType(listing.type);
  if (!type) return false;
  if (!Array.isArray(buyer.typePrefs) || buyer.typePrefs.length === 0) return false;
  if (!buyer.typePrefs.some((pref) => normalizeType(pref) === type)) return false;

  const price = resolveListingPrice(type, listing);
  if (price == null) return false;
  if (typeof buyer.budgetMin === "number" && price < buyer.budgetMin) return false;
  if (typeof buyer.budgetMax === "number" && price > buyer.budgetMax) return false;
  if (type === "월세") {
    const monthly = listing.monthly ?? price;
    if (typeof buyer.monthlyMax === "number" && monthly > buyer.monthlyMax) return false;
  }

  const area = typeof listing.area_py === "number" ? listing.area_py : undefined;
  if (area == null) return false;
  if (typeof buyer.areaMinPy === "number" && area < buyer.areaMinPy) return false;
  if (typeof buyer.areaMaxPy === "number" && area > buyer.areaMaxPy) return false;
  if (Array.isArray(buyer.areaPrefsPy) && buyer.areaPrefsPy.length > 0) {
    const ok = buyer.areaPrefsPy.some((preferred) => Math.abs(preferred - area) <= 1);
    if (!ok) return false;
  }

  return true;
}

export function makeBuyerKey(buyer: MatchBuyer): string {
  return JSON.stringify([
    buyer.typePrefs,
    buyer.budgetMin,
    buyer.budgetMax,
    buyer.monthlyMax,
    buyer.areaMinPy,
    buyer.areaMaxPy,
    buyer.areaPrefsPy,
    buyer.status,
    buyer.updatedAt,
  ]);
}

export function makeListingKey(listing: MatchListing): string {
  return JSON.stringify([
    listing.type,
    listing.area_py,
    listing.price,
    listing.deposit,
    listing.monthly,
    listing.status,
    listing.closedByUs,
    listing.deletedAt,
    listing.updatedAt,
  ]);
}

export function matchListingsForBuyer(buyer: MatchBuyer, listings: MatchListing[], limit = 10): MatchEntry[] {
  return listings
    .map((listing) => ({ id: listing.id, score: calcMatchScore(buyer, listing), strict: isStrictMatch(buyer, listing) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function matchBuyersForListing(listing: MatchListing, buyers: MatchBuyer[], limit = 10): MatchEntry[] {
  return buyers
    .map((buyer) => ({ id: buyer.id, score: calcMatchScore(buyer, listing), strict: isStrictMatch(buyer, listing) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
