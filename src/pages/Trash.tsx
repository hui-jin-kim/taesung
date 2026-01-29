import React from "react";
import Navbar from "../components/AppNavbar";
import { useTrashBuyers, restoreBuyer } from "../state/useBuyers";
import { useTrashListings } from "../state/useTrashListings";
import { restoreListing } from "../state/useListings";
import { hardDeleteBuyers, hardDeleteListings } from "../lib/delete";
import { formatAreaPy, mergeAreaSuffix } from "../lib/format";
import { useAuth } from "../context/AuthContext";

export default function Trash() {
  const buyers = useTrashBuyers();
  const listings = useTrashListings();
  const { user } = useAuth();
  const role = (user as any)?.role;
  const isAdmin = role === "owner" || role === "admin";
  const [tab, setTab] = React.useState<"listings" | "buyers">("listings");

  const handleBulkDelete = React.useCallback(
    async (target: "listings" | "buyers") => {
      if (!isAdmin) return;
      const targetItems = target === "listings" ? listings : buyers;
      if (!targetItems.length) return;
      const phrase = prompt(
        `선택한 ${target === "listings" ? "매물" : "매수자"} ${targetItems.length}건을 영구 삭제합니다.\n'영구 삭제'를 입력해 확인해 주세요.`
      );
      if (phrase !== "영구 삭제") return;
      if (target === "listings") {
        await hardDeleteListings(targetItems.map((item: any) => item.id));
      } else {
        await hardDeleteBuyers(targetItems.map((item: any) => item.id));
      }
    },
    [buyers, isAdmin, listings]
  );

  const renderDeleteButton = (onClick: () => void) =>
    isAdmin ? (
      <button
        type="button"
        onClick={onClick}
        className="text-white bg-red-700 rounded px-2 py-1 text-[12px]"
        title="영구 삭제"
      >
        영구 삭제
      </button>
    ) : null;

  const confirmSingleDelete = async (handler: () => Promise<void>) => {
    const phrase = prompt("영구 삭제를 되돌릴 수 없습니다.\n'영구 삭제'를 입력해 주세요.");
    if (phrase !== "영구 삭제") return;
    await handler();
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">휴지통</h1>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg bg-white ring-1 ring-neutral-300 overflow-hidden">
              <button
                type="button"
                className={`h-9 px-3 text-sm ${
                  tab === "listings" ? "bg-neutral-900 text-white" : "text-neutral-800"
                }`}
                onClick={() => setTab("listings")}
              >
                매물 {listings.length}
              </button>
              <button
                type="button"
                className={`h-9 px-3 text-sm ${
                  tab === "buyers" ? "bg-neutral-900 text-white" : "text-neutral-800"
                }`}
                onClick={() => setTab("buyers")}
              >
                매수자 {buyers.length}
              </button>
            </div>
            {isAdmin && tab === "listings" && listings.length > 0 ? (
              <button
                type="button"
                className="h-9 px-3 rounded-lg bg-red-700 text-white text-sm"
                onClick={() => handleBulkDelete("listings")}
              >
                전체 영구 삭제
              </button>
            ) : null}
            {isAdmin && tab === "buyers" && buyers.length > 0 ? (
              <button
                type="button"
                className="h-9 px-3 rounded-lg bg-red-700 text-white text-sm"
                onClick={() => handleBulkDelete("buyers")}
              >
                전체 영구 삭제
              </button>
            ) : null}
          </div>
        </div>

        {tab === "listings" ? (
          listings.length === 0 ? (
            <div className="text-sm text-neutral-500">휴지통에 매물이 없습니다.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {listings.map((r: any) => (
                <div key={r.id} className="bg-white rounded-2xl ring-1 ring-neutral-200 px-4 py-5">
                  <div className="text-base font-semibold">
                    {r.title || r.name || r.address || "(무제)"}
                  </div>
                  <div className="text-sm text-neutral-700 mt-0.5">
                    면적{" "}
                    {formatAreaPy(
                      r.area_py,
                      mergeAreaSuffix((r as any).areaSuffix, (r as any).typeSuffix),
                    )}{" "}
                    · 가격{" "}
                    {r.price_text || r.price || "-"}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      className="text-blue-600 text-sm hover:underline"
                      onClick={async () => {
                        await restoreListing(r.id, r.deletedPrevStatus as any);
                      }}
                      title="복구"
                    >
                      복구
                    </button>
                    {renderDeleteButton(() =>
                      confirmSingleDelete(async () => {
                        await hardDeleteListings([r.id]);
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : buyers.length === 0 ? (
          <div className="text-sm text-neutral-500">휴지통에 매수자가 없습니다.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {buyers.map((b: any) => (
              <div key={b.id} className="bg-white rounded-2xl ring-1 ring-neutral-200 px-4 py-5">
                <div className="text-base font-semibold">{b.name || "-"}</div>
                <div className="text-sm text-neutral-700 mt-0.5">
                  {b.phone || <span className="text-neutral-400">비공개</span>}
                </div>
                <div className="mt-1 text-[12px] text-neutral-500 line-clamp-2 min-h-[1.25rem]">
                  {b.notes || "-"}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    className="text-blue-600 text-sm hover:underline"
                    onClick={async () => {
                      await restoreBuyer(b.id);
                    }}
                    title="복구"
                  >
                    복구
                  </button>
                  {renderDeleteButton(() =>
                    confirmSingleDelete(async () => {
                      await hardDeleteBuyers([b.id]);
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
