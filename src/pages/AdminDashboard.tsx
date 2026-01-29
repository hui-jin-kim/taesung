import React from "react";
import AdminFrame from "../components/AdminFrame";
import { useListings } from "../state/useListings";
import { useBuyers } from "../state/useBuyers";
import { useSettings } from "../lib/settings";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Line,
  CartesianGrid,
  LabelList,
} from "recharts";

const MONTH_WINDOW = 12;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

function isActiveListing(listing: any) {
  if (listing?.deletedAt) return false;
  if (listing?.isActive === false) return false;
  if (listing?.closedAt || listing?.completedAt || listing?.closedByUs) return false;
  const status = String(listing?.status ?? "").toLowerCase();
  const closedTokens = ["완료", "종료", "계약", "마감", "거래완료", "closed", "complete", "completed", "archived", "deleted"];
  if (closedTokens.some((token) => status.includes(token))) return false;
  return true;
}

function toMillis(value?: number | string | { toMillis?: () => number }) {
  if (!value) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (typeof value === "object" && typeof value?.toMillis === "function") {
    try {
      return value.toMillis();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function getMonthKey(ms?: number) {
  if (!ms) return undefined;
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return undefined;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthKeys(count = MONTH_WINDOW) {
  const keys: string[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function buildMonthCountMap(keys: string[]) {
  return keys.reduce<Record<string, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
}

function monthLabel(key: string) {
  const [, m] = key.split("-");
  return `${Number(m)}월`;
}

function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-white/95 p-4 shadow-[0_12px_30px_rgba(14,165,233,0.06)]">
      <div className="text-[12px] font-semibold tracking-[0.06em] text-sky-700">{label}</div>
      <div className="mt-1 text-3xl font-bold leading-tight text-neutral-900">{value}</div>
      {hint ? <div className="mt-2 text-sm text-neutral-500">{hint}</div> : null}
    </div>
  );
}

function CardShell({
  title,
  desc,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-sky-100 bg-white/90 p-3 shadow-[0_8px_24px_rgba(14,165,233,0.08)] ${className}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-900 leading-tight">{title}</p>
          {desc ? <p className="text-[12px] text-neutral-500">{desc}</p> : null}
        </div>
      </div>
      <div className={`mt-2 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const listings = useListings();
  const buyers = useBuyers();
  const { settings } = useSettings();

  const monthKeys = React.useMemo(() => buildMonthKeys(MONTH_WINDOW), []);
  const [kakaoLoginsByMonth, setKakaoLoginsByMonth] = React.useState<Record<string, number>>(() =>
    buildMonthCountMap(monthKeys),
  );

  React.useEffect(() => {
    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - (MONTH_WINDOW - 1), 1);
    const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const q = query(
      collection(db, "loginEvents"),
      where("createdAt", ">=", rangeStart),
      where("createdAt", "<", rangeEnd),
      orderBy("createdAt", "asc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const map = buildMonthCountMap(monthKeys);
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (String(data?.provider || "").toLowerCase() !== "kakao") return;
          const ts = toMillis(data?.createdAt);
          const key = getMonthKey(ts);
          if (key && map[key] != null) map[key] += 1;
        });
        setKakaoLoginsByMonth(map);
      },
      (err) => {
        console.error("loginEvents snapshot error", err);
      },
    );
    return () => unsub();
  }, [monthKeys]);

  const {
    stats,
    monthlySeries,
    leadSeries,
    typeSummary,
    expiringSoon,
    complexSummary,
    pyeongPriceSeries,
  } = React.useMemo(() => {
    const now = Date.now();
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthStart.getMonth() + 1);
    const monthStartMs = monthStart.getTime();
    const monthEndMs = monthEnd.getTime();
    const currentMonthKey = getMonthKey(monthStartMs);
    const kakaoLoginsMonth = currentMonthKey ? kakaoLoginsByMonth[currentMonthKey] || 0 : 0;
    const expiryWindow = Number((settings as any)?.expiryAlertDays ?? 60);

    const monthlyMap = monthKeys.reduce<Record<string, { newListings: number; closedListings: number; ourDeals: number }>>(
      (acc, key) => {
        acc[key] = { newListings: 0, closedListings: 0, ourDeals: 0 };
        return acc;
      },
      {},
    );

    const leadMonthlyMap = monthKeys.reduce<Record<string, { newBuyers: number }>>(
      (acc, key) => {
        acc[key] = { newBuyers: 0 };
        return acc;
      },
      {},
    );

    let activeListings = 0;
    let newListingsMonth = 0;
    let closedMonth = 0;
    let ourDealsMonth = 0;
    let urgentListings = 0;
    let saleCount = 0;
    let jeonseCount = 0;
    let wolseCount = 0;
    let activeBuyers = 0;
    let newBuyersMonth = 0;

    const typeCounts: Record<string, number> = {};
    const expiring: { id: string; title: string; daysLeft: number }[] = [];

    const complexMap: Record<
      string,
      {
        count: number;
        saleSum: number;
        saleCnt: number;
        jeonseSum: number;
        jeonseCnt: number;
        wolseSum: number;
        wolseCnt: number;
      }
    > = {};

    const pyeongMap: Record<
      string,
      { saleSum: number; saleCnt: number; jeonseSum: number; jeonseCnt: number; wolseSum: number; wolseCnt: number }
    > = {};

    listings.forEach((listing) => {
      if (listing?.deletedAt) return;
      const created = toMillis(listing.createdAt);
      const closed = toMillis(listing.closedAt ?? listing.completedAt);
      const expiry = toMillis(listing.expiryAt);
      const type = listing.type || "기타";
      const active = isActiveListing(listing);
      if (active) typeCounts[type] = (typeCounts[type] || 0) + 1;

      if (active) activeListings += 1;
      if (listing.urgent && active) urgentListings += 1;
      if (active && created && created >= monthStartMs && created < monthEndMs) newListingsMonth += 1;
      if (closed && closed >= monthStartMs && closed < monthEndMs) {
        closedMonth += 1;
        if (listing.closedByUs) ourDealsMonth += 1;
      }

      const complexKey = listing.complex || listing.title || "미정";
      if (active) {
        if (!complexMap[complexKey]) {
          complexMap[complexKey] = {
            count: 0,
            saleSum: 0,
            saleCnt: 0,
            jeonseSum: 0,
            jeonseCnt: 0,
            wolseSum: 0,
            wolseCnt: 0,
          };
        }
        complexMap[complexKey].count += 1;
      }

      const py = Number(listing.area_py || listing.areaSuffix || 0) || undefined;
      const bucketKey = py ? `${Math.round(py / 5) * 5}평` : undefined;
      if (bucketKey && !pyeongMap[bucketKey]) {
        pyeongMap[bucketKey] = { saleSum: 0, saleCnt: 0, jeonseSum: 0, jeonseCnt: 0, wolseSum: 0, wolseCnt: 0 };
      }

      const price = Number(listing.price) || 0;
      const deposit = Number(listing.deposit) || 0;
      const monthly = Number(listing.monthly) || 0;

      if (type.includes("매매")) {
        if (active) saleCount += 1;
        if (price) {
          if (active && complexMap[complexKey]) {
            complexMap[complexKey].saleSum += price;
            complexMap[complexKey].saleCnt += 1;
          }
          if (bucketKey) {
            pyeongMap[bucketKey].saleSum += price;
            pyeongMap[bucketKey].saleCnt += 1;
          }
        }
      } else if (type.includes("전세")) {
        if (active) jeonseCount += 1;
        if (deposit) {
          if (active && complexMap[complexKey]) {
            complexMap[complexKey].jeonseSum += deposit;
            complexMap[complexKey].jeonseCnt += 1;
          }
          if (bucketKey) {
            pyeongMap[bucketKey].jeonseSum += deposit;
            pyeongMap[bucketKey].jeonseCnt += 1;
          }
        }
      } else if (type.includes("월세")) {
        if (active) wolseCount += 1;
        const base = deposit || price;
        if (base) {
          if (active && complexMap[complexKey]) {
            complexMap[complexKey].wolseSum += base;
            complexMap[complexKey].wolseCnt += 1;
          }
          if (bucketKey) {
            pyeongMap[bucketKey].wolseSum += base;
            pyeongMap[bucketKey].wolseCnt += 1;
          }
        }
      }

      if (active && created) {
        const createdKey = getMonthKey(created);
        if (createdKey && monthlyMap[createdKey]) {
          monthlyMap[createdKey].newListings += 1;
        }
      }

      if (closed) {
        const closedKey = getMonthKey(closed);
        if (closedKey && monthlyMap[closedKey]) {
          monthlyMap[closedKey].closedListings += 1;
          if (listing.closedByUs) monthlyMap[closedKey].ourDeals += 1;
        }
      }

      if (expiry) {
        const daysLeft = Math.ceil((expiry - now) / MS_IN_DAY);
        if (daysLeft > 0 && daysLeft <= expiryWindow) {
          expiring.push({
            id: listing.id,
            title: listing.title || listing.complex || listing.id,
            daysLeft,
          });
        }
      }
    });

    buyers.forEach((buyer) => {
      if (buyer?.deletedAt) return;
      activeBuyers += 1;
      const created = toMillis(buyer.createdAt);
      if (created && created >= monthStartMs && created < monthEndMs) newBuyersMonth += 1;
      const key = getMonthKey(created);
      if (key && leadMonthlyMap[key]) {
        leadMonthlyMap[key].newBuyers += 1;
      }
    });

    const monthlySeries = monthKeys.map((key) => ({
      key,
      label: monthLabel(key),
      ...monthlyMap[key],
    }));

    const leadSeries = monthKeys.map((key) => ({
      key,
      label: monthLabel(key),
      newBuyers: leadMonthlyMap[key].newBuyers,
      kakaoLogins: kakaoLoginsByMonth[key] || 0,
    }));

    expiring.sort((a, b) => a.daysLeft - b.daysLeft);

    return {
      stats: {
        activeListings,
        newListingsMonth,
        closedMonth,
        ourDealsMonth,
        activeBuyers,
        newBuyersMonth,
        kakaoLoginsMonth,
        urgentListings,
        saleCount,
        jeonseCount,
        wolseCount,
      },
      monthlySeries,
      leadSeries,
      typeSummary: Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([label, count]) => ({ label, count })),
      expiringSoon: expiring.slice(0, 5),
      complexSummary: Object.entries(complexMap)
        .map(([label, v]) => ({
          label,
          count: v.count,
          saleAvg: v.saleCnt ? v.saleSum / v.saleCnt : 0,
          jeonseAvg: v.jeonseCnt ? v.jeonseSum / v.jeonseCnt : 0,
          wolseAvg: v.wolseCnt ? v.wolseSum / v.wolseCnt : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 7),
      pyeongPriceSeries: Object.entries(pyeongMap)
        .map(([bucket, v]) => ({
          bucket,
          sale: v.saleCnt ? v.saleSum / v.saleCnt : 0,
          jeonse: v.jeonseCnt ? v.jeonseSum / v.jeonseCnt : 0,
          wolse: v.wolseCnt ? v.wolseSum / v.wolseCnt : 0,
        }))
        .sort((a, b) => Number(a.bucket.replace(/[^0-9]/g, "")) - Number(b.bucket.replace(/[^0-9]/g, ""))),
    };
  }, [buyers, kakaoLoginsByMonth, listings, monthKeys, settings]);

  const formatEok = (v?: number) => {
    if (!v || Number.isNaN(v)) return "-";
    return `${(v / 10000).toFixed(1).replace(/\\.0$/, "")}억`;
  };

  return (
    <AdminFrame title="운영 대시보드">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="활성 매물" value={`${stats.activeListings.toLocaleString()}건`} hint={`긴급 ${stats.urgentListings.toLocaleString()}건`} />
        <StatCard label="신규 매물(이번달)" value={`${stats.newListingsMonth.toLocaleString()}건`} hint="이번달 등록" />
        <StatCard label="거래 완료(이번달)" value={`${stats.closedMonth.toLocaleString()}건`} hint={`우리 거래 ${stats.ourDealsMonth.toLocaleString()}건`} />
        <StatCard label="활성 매수" value={`${stats.activeBuyers.toLocaleString()}건`} hint={`이번달 신규 ${stats.newBuyersMonth.toLocaleString()}건`} />
        <StatCard label="뷰어 신청(이번달)" value={`${stats.kakaoLoginsMonth.toLocaleString()}건`} hint="카카오 로그인(중복 포함)" />
        <StatCard
          label="유형 분포"
          value={
            <div className="flex justify-between text-center text-neutral-700">
              <div className="flex-1">
                <div className="text-sm text-neutral-500">매매</div>
                <div className="text-2xl font-semibold">{(stats.saleCount ?? 0).toLocaleString()}건</div>
              </div>
              <div className="flex-1">
                <div className="text-sm text-neutral-500">전세</div>
                <div className="text-2xl font-semibold">{(stats.jeonseCount ?? 0).toLocaleString()}건</div>
              </div>
              <div className="flex-1">
                <div className="text-sm text-neutral-500">월세</div>
                <div className="text-2xl font-semibold">{(stats.wolseCount ?? 0).toLocaleString()}건</div>
              </div>
            </div>
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 auto-rows-[230px]">
        <CardShell title="월별 파이프라인" desc="신규 / 완료 / 우리 거래" className="col-span-1 md:col-span-2" bodyClassName="h-[180px]">
          {monthlySeries ? (
            <ResponsiveContainer>
              <ComposedChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="newListings" name="신규 매물" fill="#38bdf8" />
                <Bar dataKey="closedListings" name="거래 완료" fill="#0ea5e9" />
                <Line type="monotone" dataKey="ourDeals" name="우리 거래" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">데이터가 없습니다.</div>
          )}
        </CardShell>

        <CardShell title="신청 · 조회 동향" desc="카카오 로그인 vs 신규 매수" className="col-span-1 md:col-span-2" bodyClassName="h-[180px]">
          {leadSeries.length ? (
            <ResponsiveContainer>
              <LineChart data={leadSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="kakaoLogins" name="카카오 로그인" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="newBuyers" name="신규 매수" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">데이터가 없습니다.</div>
          )}
        </CardShell>

        <CardShell title="단지별 요약" desc="활성 매물 기준 상위 7" className="col-span-1 md:col-span-2 min-h-[360px]" bodyClassName="h-[260px]">
          {complexSummary.length ? (
            <ResponsiveContainer>
              <ComposedChart
                data={complexSummary.slice(0, 7)}
                layout="vertical"
                margin={{ left: 70, right: 20, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} width={120} />
                <Tooltip formatter={(v: number) => `${v.toLocaleString()}건`} />
                <Bar dataKey="count" name="건수" barSize={16} radius={[0, 8, 8, 0]} fill="#38bdf8">
                  <LabelList
                    dataKey="count"
                    position="right"
                    formatter={(label) => (typeof label === "number" ? `${label}건` : label ?? "")}
                    fill="#0f172a"
                    fontSize={12}
                  />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">데이터가 없습니다.</div>
          )}
        </CardShell><CardShell title="평형대별 평균가" desc="매매 / 전세 / 월세" className="col-span-1 md:col-span-2 min-h-[360px]" bodyClassName="h-[300px]">
          {pyeongPriceSeries.length ? (
            <ResponsiveContainer>
              <ComposedChart data={pyeongPriceSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" />
                <YAxis tickFormatter={(v) => `${(v / 10000).toFixed(0)}억`} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sale" name="매매" fill="#fb7185" />
                <Bar dataKey="jeonse" name="전세" fill="#22c55e" />
                <Bar dataKey="wolse" name="월세" fill="#f59e0b" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">데이터가 없습니다.</div>
          )}
        </CardShell>
      </div>
    </AdminFrame>
  );
}





