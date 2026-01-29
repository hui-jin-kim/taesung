// src/components/MatchResultsForBuyer.tsx
// 역할: 특정 buyerId에 대한 상위 매칭 매물 리스트(Top3/Top10) 렌더

import React from "react";
import { useMatches } from "../state/useMatches";
import { useListings } from "../state/useListings";
import type { Listing } from "../types/core";

function formatPrice(l: Listing) {
  if (l.type === "매매") return `${(l.price ?? 0).toLocaleString()}만원`;
  const deposit = l.deposit != null ? `${l.deposit.toLocaleString()}만원` : "-";
  const monthly = l.monthly != null ? `${l.monthly.toLocaleString()}만원` : "";
  return `${deposit}${monthly ? `/${monthly}` : ""}`;
}

export default function MatchResultsForBuyer({ buyerId, limit = 3 }: { buyerId: string; limit?: number }) {
  const matches = useMatches();
  const listings = useListings();
  const [expanded, setExpanded] = React.useState(false);

  const data = matches.getForBuyer(buyerId, expanded ? Math.max(10, limit) : limit);
  if (!data || data.length === 0) return null;
  const listingById = new Map(listings.map((l) => [l.id, l] as const));

  return (
    <div className="mt-3 border-t pt-2">
      <div className="text-[12px] text-neutral-500 mb-1">조건 부합 매물</div>
      <div className="space-y-1">
        {data.map((m) => {
          const l = listingById.get(m.id);
          if (!l) return null;
          return (
            <div key={m.id} className="text-[12px] text-neutral-700 flex items-center gap-2">
              <span className="inline-block w-8 text-neutral-500">{m.score}점</span>
              <span className="truncate" title={l.title || l.complex}>{l.complex || l.title || l.id}</span>
              <span className="text-neutral-500">·</span>
              <span className="whitespace-nowrap">{formatPrice(l)}</span>
              <span className="text-neutral-500">·</span>
              <span className="whitespace-nowrap">{l.type}</span>
            </div>
          );
        })}
      </div>
      <button className="mt-1 text-[12px] text-blue-600 hover:underline" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? "접기" : "더보기"}>
        {expanded ? "접기" : "더보기"}
      </button>
    </div>
  );
}

