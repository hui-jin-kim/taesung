// src/components/MatchedBuyersForListing.tsx
// 역할: 특정 listingId에 대한 상위 매칭 매수자 리스트(Top5) 렌더

import React from "react";
import { useMatches } from "../state/useMatches";
import { useBuyers } from "../state/useBuyers";

export default function MatchedBuyersForListing({ listingId, limit = 5 }: { listingId: string; limit?: number }) {
  const matches = useMatches();
  const buyers = useBuyers();
  const data = matches.getForListing(listingId, limit);
  if (!data || data.length === 0) return null;
  const byId = new Map(buyers.map((b) => [b.id, b] as const));

  return (
    <div className="mt-6">
      <div className="text-sm font-semibold mb-2">이 매물에 관심 있을 법한 매수자</div>
      <div className="space-y-1">
        {data.map((m) => {
          const b = byId.get(m.id);
          if (!b) return null;
          return (
            <div key={m.id} className="text-[12px] text-neutral-700 flex items-center gap-2">
              <span className="inline-block w-8 text-neutral-500">{m.score}점</span>
              <span className="font-medium">{b.name}</span>
              <span className="text-neutral-500">·</span>
              <span className="whitespace-nowrap">
                예산 {b.budgetMin ?? '-'}~{b.budgetMax ?? '-'}만원
              </span>
              {b.notes ? <span className="text-neutral-500 truncate">· {b.notes}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

