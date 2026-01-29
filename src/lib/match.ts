// src/lib/match.ts
// Buyers ↔ Listings 매칭 로직과 공유 유틸리티

import type { Buyer, Listing } from "../types/core";

export type MatchEntry = { id: string; score: number };

export function calcMatchScore(buyer: Buyer, listing: Listing): number {
  if (listing.status && (listing.status.includes("종료") || listing.status.includes("완료"))) return 0;

  let score = 0;

  const listingType: "매매" | "전세" | "월세" | undefined =
    listing.type === "매매" || listing.type === "전세" || listing.type === "월세" ? listing.type : undefined;

  if (!buyer.typePrefs || buyer.typePrefs.length === 0 || (listingType && buyer.typePrefs.includes(listingType))) {
    if (buyer.typePrefs && buyer.typePrefs.length > 0 && listingType && buyer.typePrefs.includes(listingType)) {
      score += 2;
    }
  } else {
    return 0;
  }

  const priceForType = listingType === "매매" ? listing.price : listing.deposit ?? undefined;
  if (priceForType != null && (buyer.budgetMin != null || buyer.budgetMax != null)) {
    const withinMin = buyer.budgetMin == null || priceForType >= buyer.budgetMin;
    const withinMax = buyer.budgetMax == null || priceForType <= buyer.budgetMax;
    const monthlyOk =
      listingType !== "월세" || buyer.monthlyMax == null || (listing.monthly ?? 0) <= buyer.monthlyMax;
    if (withinMin && withinMax && monthlyOk) score += 2;
  }

  if (buyer.areaPrefsPy && buyer.areaPrefsPy.length > 0 && typeof listing.area_py === "number") {
    const areaValue = listing.area_py;
    const exact = buyer.areaPrefsPy.includes(areaValue);
    if (exact) score += 2;
    else {
      const near = buyer.areaPrefsPy.some((preferred) => Math.abs(preferred - areaValue) <= 1);
      if (near) score += 1;
    }
  }

  if (buyer.complexPrefs && buyer.complexPrefs.length > 0 && listing.complex) {
    if (buyer.complexPrefs.includes(listing.complex)) score += 2;
  }

  if (buyer.mustHaves && buyer.mustHaves.length > 0 && listing.memo) {
    const memo = String(listing.memo).toLowerCase();
    if (buyer.mustHaves.every((tag) => memo.includes(String(tag).toLowerCase()))) score += 2;
  }

  return score;
}

export function matchListingsForBuyer(buyer: Buyer, listings: Listing[], threshold = 5): MatchEntry[] {
  return listings
    .map((listing) => ({ id: listing.id, score: calcMatchScore(buyer, listing) }))
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

export function matchBuyersForListing(listing: Listing, buyers: Buyer[], threshold = 5): MatchEntry[] {
  return buyers
    .map((buyer) => ({ id: buyer.id, score: calcMatchScore(buyer, listing) }))
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
