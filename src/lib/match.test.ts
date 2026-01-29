// src/lib/match.test.ts
// 간단한 매칭 스모크 테스트 (console.assert)
import { calcMatchScore, matchListingsForBuyer, matchBuyersForListing } from "./match";
import type { Buyer, Listing } from "../types/core";

const buyer: Buyer = {
  id: "b",
  name: "테스트",
  budgetMin: 5000,
  budgetMax: 10000,
  monthlyMax: 200,
  typePrefs: ["전세", "월세", "매매"],
  areaPrefsPy: [25, 33],
  complexPrefs: ["테스트단지"],
  mustHaves: ["남향"],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const listing: Listing = {
  id: "l",
  complex: "테스트단지",
  area_py: 33,
  type: "매매",
  price: 8000,
  title: "테스트 매물",
  memo: "남향, 로얄층",
  status: "진행중",
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const s = calcMatchScore(buyer, listing);
console.assert(s >= 5, `score should be >=5, got ${s}`);

const ls = [listing];
const bs = [buyer];
const m1 = matchListingsForBuyer(buyer, ls);
const m2 = matchBuyersForListing(listing, bs);
console.assert(m1.length === 1 && m1[0].id === listing.id, "buyer->listings failed");
console.assert(m2.length === 1 && m2[0].id === buyer.id, "listing->buyers failed");

export {}; // make this a module
