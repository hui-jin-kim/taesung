// src/state/useMatches.ts
// Buyers/Listings 상태 변경을 감지해 매칭 결과를 캐시·제공하는 클라이언트 상태 모듈

import React from "react";
import {
  getMatchBuyers,
  getMatchListings,
  useMatchBuyersVersion,
  useMatchListingsVersion,
} from "./useMatchSources";
import type { MatchEntry } from "../types/match";

type MatchesBuckets = {
  byBuyer: Record<string, MatchEntry[]>;
  byListing: Record<string, MatchEntry[]>;
};

export type MatchesState = MatchesBuckets & {
  getForBuyer: (buyerId: string, limit?: number) => MatchEntry[];
  getForListing: (listingId: string, limit?: number) => MatchEntry[];
  getCountForListing: (listingId: string, threshold?: number) => number;
};

export function triggerDirtyFor(target: "listing" | "buyer", id: string) {
  // Server-side Functions handle actual matching now.
  // We still dispatch a synthetic event so components depending on this hook
  // can re-read if needed (e.g., after optimistic updates).
  try {
    window.dispatchEvent(new Event("matches-dirty"));
  } catch {
    // no-op: mainly for test environments without window
  }
}

export function useMatches(): MatchesState {
  const buyersVersion = useMatchBuyersVersion();
  const listingsVersion = useMatchListingsVersion();

  const [buckets, setBuckets] = React.useState<MatchesBuckets>({ byBuyer: {}, byListing: {} });
  const [extTick, setExtTick] = React.useState(0);

  React.useEffect(() => {
    const onDirty = () => setExtTick((x) => x + 1);
    window.addEventListener("matches-dirty", onDirty);
    return () => window.removeEventListener("matches-dirty", onDirty);
  }, []);

  React.useEffect(() => {
    const buyers = getMatchBuyers();
    const listings = getMatchListings();

    setBuckets(() => {
      const byListing: Record<string, MatchEntry[]> = {};
      const byBuyer: Record<string, MatchEntry[]> = {};

      listings.forEach((listing) => {
        if (listing.matchedBuyers && listing.matchedBuyers.length > 0) {
          byListing[listing.id] = listing.matchedBuyers.slice();
          return;
        }
        if (listing.matchedBuyerIds && listing.matchedBuyerIds.length > 0) {
          byListing[listing.id] = listing.matchedBuyerIds.map((id) => ({ id, score: 0 }));
        }
      });

      buyers.forEach((buyer) => {
        if (buyer.matches && buyer.matches.length > 0) {
          byBuyer[buyer.id] = buyer.matches.slice();
          return;
        }
        if (buyer.listingIds && buyer.listingIds.length > 0) {
          byBuyer[buyer.id] = buyer.listingIds.map((id) => ({ id, score: 0 }));
        }
      });

      return { byBuyer, byListing };
    });
  }, [buyersVersion, listingsVersion, extTick]);

  const getForBuyer = React.useCallback(
    (id: string, limit = 10) => {
      const list = buckets.byBuyer[id];
      if (!list || list.length === 0) return [];
      const normalizedLimit = typeof limit === "number" && limit > 0 ? limit : list.length;
      return list.slice(0, normalizedLimit);
    },
    [buckets.byBuyer],
  );

  const getForListing = React.useCallback(
    (id: string, limit = 10) => {
      const list = buckets.byListing[id];
      if (!list || list.length === 0) return [];
      const normalizedLimit = typeof limit === "number" && limit > 0 ? limit : list.length;
      return list.slice(0, normalizedLimit);
    },
    [buckets.byListing],
  );

  const getCountForListing = React.useCallback(
    (id: string, threshold = 5) =>
      buckets.byListing[id]
        ? Math.min(buckets.byListing[id].filter((entry) => entry.score >= threshold).length, 10)
        : 0,
    [buckets.byListing],
  );

  return React.useMemo(
    () => ({
      byBuyer: buckets.byBuyer,
      byListing: buckets.byListing,
      getForBuyer,
      getForListing,
      getCountForListing,
    }),
    [buckets.byBuyer, buckets.byListing, getForBuyer, getForListing, getCountForListing],
  );
}
