import React from 'react';
import { useDailyRealprice, m2ToPyeong, findLatestAvgAndCount } from '../hooks/useDailyRealprice';

function fmtKRW(v: number) {
  const n = Number(v) / 100_000_000;
  return `${n.toFixed(2)}억`;
}

export default function RealpriceBadge(props: { complex?: string; pyeong?: number; areaM2?: number }) {
  const { complex = '', pyeong, areaM2 } = props;
  const { snap, loading } = useDailyRealprice();

  if (!complex || loading || !snap) return null;

  const targetPyeong = pyeong ?? m2ToPyeong(areaM2);
  const { month, price, count } = findLatestAvgAndCount({
    snap,
    complex,
    pyeong: targetPyeong,
    kind: 'sale',
    agg: 'avg',
  });

  if (!month) return null;

  return (
    <div className="mt-1 text-[12px] text-neutral-600 flex items-center gap-2">
      <span className="rounded bg-neutral-100 px-2 py-[2px]">Realprice</span>
      <span>{month}</span>
      <span className="font-semibold text-neutral-800">{fmtKRW(price)}</span>
      <span className="text-neutral-400">· {count}건</span>
    </div>
  );
}

