import React from "react";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import AdminFrame from "../components/AdminFrame";
import { useCuratedSets, type CuratedSet } from "../state/useCuratedSets";

type ListingLite = {
  id: string;
  complex?: string;
  dong?: string;
  ho?: string;
  unit?: string;
  type?: string;
  py?: number;
  price?: number;
  monthly?: number;
  status?: string;
  isActive?: boolean;
  completedAt?: any;
  deletedAt?: any;
};

function uniq(arr: string[]) {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
}

function formatPrice(v?: number) {
  if (!v) return "-";
  if (v >= 10000) return `${Math.round(v / 10000)}억`;
  return `${v.toLocaleString("ko-KR")}만원`;
}

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "");
const normalizeHard = (s: string) => s.toLowerCase().replace(/[\s-]/g, "");

const isSelectableListing = (row: ListingLite & { status?: string; deletedAt?: any; isActive?: boolean; completedAt?: any }) => {
  const status = String(row.status || "").toLowerCase();
  if (row.deletedAt) return false;
  if (row.isActive === false) return false; // undefined/null은 허용
  if (row.completedAt) return false;
  if (["archived", "deleted", "closed", "completed"].some((v) => status.includes(v))) return false;
  if (["완료", "종료", "계약"].some((v) => status.includes(v))) return false;
  // status 비어 있거나 기타 값이어도 금칙어만 없으면 통과
  return true;
};

export default function AdminCurations() {
  const { user } = useAuth();
  const { sets, loading } = useCuratedSets();
  const [editing, setEditing] = React.useState<CuratedSet | null>(null);
  const [itemsText, setItemsText] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [selectedDetails, setSelectedDetails] = React.useState<Record<string, ListingLite>>({});
  const [searchTerm, setSearchTerm] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<ListingLite[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!editing) return;
    setItemsText(editing.items.join("\n"));
    setSelectedIds(editing.items);
    loadSelectedDetails(editing.items);
  }, [editing]);

  const startNew = () => {
    setEditing({ id: "", title: "", subtitle: "", items: [], status: "active" });
    setItemsText("");
    setSelectedIds([]);
    setSelectedDetails({});
  };

  const handleSave = async () => {
    if (!editing) return;
    const autoId = editing.title.trim() ? editing.title.trim().replace(/\s+/g, "-").toLowerCase() : `preset-${Date.now()}`;
    const id = editing.id.trim() || autoId;
    if (!id) {
      alert("ID를 입력해주세요.");
      return;
    }
    const payload: CuratedSet = {
      id,
      title: editing.title || id,
      subtitle: editing.subtitle || "",
      items: uniq([...selectedIds, ...itemsText.split(/\r?\n|,/)]),
      status: editing.status || "active",
      updatedAt: Date.now(),
      updatedBy: user?.email || user?.uid || "unknown",
    };
    setSaving(true);
    try {
      await setDoc(doc(db, "curated_sets", id), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
      alert("저장했습니다.");
    } catch (e: any) {
      alert(e?.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = uniq([...prev, id]);
      setItemsText(next.join("\n"));
      return next;
    });
    loadSelectedDetails([id]);
  };

  const handleRemoveId = (id: string) => {
    setSelectedIds((prev) => {
      const next = prev.filter((x) => x !== id);
      setItemsText(next.join("\n"));
      return next;
    });
    setSelectedDetails((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const matchesListing = (row: ListingLite, tokens: string[]) => {
    if (!isSelectableListing(row as any)) return false;
    if (!tokens.length) return true;
    const priceLabel = row.monthly ? `${formatPrice(row.price)} / ${formatPrice(row.monthly)}` : formatPrice(row.price);
    const dongHo = [row.dong, row.ho].filter(Boolean).join("-");
    const haystack = normalize([row.id, row.complex, row.unit, dongHo, row.type, row.py ? `${row.py}평` : "", priceLabel].filter(Boolean).join(" "));
    const haystackHard = normalizeHard(haystack);
    return tokens.every((tok) => {
      const t = normalize(tok);
      const tHard = normalizeHard(tok);
      return haystack.includes(t) || haystackHard.includes(tHard);
    });
  };

  const handleSearch = async () => {
    const tokens = searchTerm
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    setSearching(true);
    try {
      const coll = collection(db, "listings");
      const snap = await getDocs(query(coll, orderBy("updatedAt", "desc"), limit(2000)));
      const rows: ListingLite[] = [];
      snap.forEach((doc) => {
        const d = doc.data() || {};
        rows.push({
          id: doc.id,
          complex: String(d.complex || "").trim(),
          dong: String(d.dong || "").trim(),
          ho: String(d.ho || "").trim(),
          unit: String(d.unit || "").trim(),
          type: String(d.type || "").trim(),
          py: Number(d.area_py || d.py || 0) || undefined,
          price: Number(d.price || d.deposit || 0) || undefined,
          monthly: Number(d.monthly || 0) || undefined,
          status: String(d.status || "").trim(),
          completedAt: d.completedAt,
          deletedAt: d.deletedAt,
          isActive: d.isActive,
        });
      });
      // direct id fetch to include docs outside window
      const idTokens = tokens.filter((t) => t.length >= 8);
      if (idTokens.length) {
        const extras = await Promise.all(
          idTokens.map(async (id) => {
            try {
              const snap = await getDoc(doc(db, "listings", id));
              if (!snap.exists()) return null;
              const d = snap.data() || {};
              return {
                id,
                complex: String(d.complex || "").trim(),
                dong: String(d.dong || "").trim(),
                ho: String(d.ho || "").trim(),
                unit: String(d.unit || "").trim(),
                type: String(d.type || "").trim(),
                py: Number(d.area_py || d.py || 0) || undefined,
                price: Number(d.price || d.deposit || 0) || undefined,
                monthly: Number(d.monthly || 0) || undefined,
                status: String(d.status || "").trim(),
                completedAt: d.completedAt,
                deletedAt: d.deletedAt,
                isActive: d.isActive,
              } as ListingLite;
            } catch {
              return null;
            }
          }),
        );
        extras.forEach((r) => r && rows.push(r));
      }
      const filtered = rows.filter((r) => matchesListing(r, tokens)).slice(0, 200);
      setSearchResults(filtered);
    } catch (e: any) {
      console.error(e);
      alert("검색 실패: " + (e?.message || ""));
    } finally {
      setSearching(false);
    }
  };

  React.useEffect(() => {
    if (searchTerm === "" && searchResults.length) {
      setSearchResults([]);
      return;
    }
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const loadSelectedDetails = async (ids: string[]) => {
    const missing = ids.filter((id) => !selectedDetails[id]);
    if (!missing.length) return;
    try {
      const pairs = await Promise.all(
        missing.map(async (id) => {
          const snap = await getDoc(doc(db, "listings", id));
          if (!snap.exists()) return null;
          const d = snap.data() || {};
          return {
            id,
            complex: String(d.complex || "").trim(),
            dong: String(d.dong || "").trim(),
            ho: String(d.ho || "").trim(),
            unit: String(d.unit || "").trim(),
            type: String(d.type || "").trim(),
            py: Number(d.area_py || d.py || 0) || undefined,
            price: Number(d.price || d.deposit || 0) || undefined,
            monthly: Number(d.monthly || 0) || undefined,
          } as ListingLite;
        }),
      );
      const next = { ...selectedDetails };
      pairs.forEach((p) => {
        if (p) next[p.id] = p;
      });
      setSelectedDetails(next);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AdminFrame title="오늘의 추천 관리">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <p className="text-sm font-semibold text-sky-600">오늘의 추천 관리</p>
          <h1 className="text-2xl font-bold text-neutral-900">추천 매물 세트</h1>
          <p className="text-sm text-neutral-600">status=active인 세트만 노출됩니다. 거래완료/삭제된 매물도 검색 결과에 포함되어 직접 선택할 수 있습니다.</p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">세트 목록</p>
              <button
                type="button"
                className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                onClick={startNew}
              >
                새로 만들기
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {loading ? <p className="text-sm text-neutral-500">불러오는 중…</p> : null}
              {!loading && sets.length === 0 ? <p className="text-sm text-neutral-500">등록된 세트가 없습니다.</p> : null}
              {sets.map((s, idx) => (
                <button
                  key={s.id || `preset-${idx + 1}`}
                  type="button"
                  onClick={() => setEditing({ ...s, id: s.id || `preset-${idx + 1}` })}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                    editing?.id === s.id ? "border-sky-500 bg-sky-50" : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <p className="font-semibold text-neutral-900">{s.title}</p>
                  <p className="text-xs text-neutral-500">
                    {s.items.length}개 · {s.status || "active"} {s.updatedAt ? `· ${new Date(s.updatedAt).toLocaleDateString()}` : ""}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:col-span-2">
            <p className="text-sm font-semibold text-neutral-900">세트 편집</p>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-600">ID (자동 생성)</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm bg-neutral-50"
                    value={editing?.id || ""}
                    readOnly
                    placeholder="제목을 입력하면 자동 생성됩니다"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-600">상태</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                    value={editing?.status || "active"}
                    onChange={(e) => setEditing((prev) => (prev ? { ...prev, status: e.target.value as any } : prev))}
                  >
                    <option value="active">active</option>
                    <option value="hidden">hidden</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-600">제목</label>
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  value={editing?.title || ""}
                  onChange={(e) => setEditing((prev) => (prev ? { ...prev, title: e.target.value, id: prev.id || "" } : prev))}
                  placeholder="예: 오늘은 이런 투자 어때요?"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-600">부제목</label>
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  value={editing?.subtitle || ""}
                  onChange={(e) => setEditing((prev) => (prev ? { ...prev, subtitle: e.target.value } : prev))}
                  placeholder="간단한 설명"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-600">직접 ID 입력 (줄바꿈/쉼표 구분)</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  rows={3}
                  value={itemsText}
                  onChange={(e) => setItemsText(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-neutral-900">선택된 매물 ({selectedIds.length}개)</p>
            <div className="mt-3 space-y-2">
              {selectedIds.length === 0 ? <p className="text-sm text-neutral-500">선택된 매물이 없습니다.</p> : null}
              {selectedIds.map((id) => {
                const row = selectedDetails[id];
                return (
                  <div key={id} className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">{row?.complex || id}</p>
                      <p className="text-xs text-neutral-500">
                        {[row?.dong || row?.unit, row?.py ? `${row.py}평` : null, row?.type].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-neutral-900">{formatPrice(row?.price)}</p>
                      {row?.monthly ? <p className="text-xs text-neutral-500">{formatPrice(row.monthly)}</p> : null}
                      <button
                        type="button"
                        className="mt-1 text-xs text-rose-500"
                        onClick={() => handleRemoveId(id)}
                      >
                        제거
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                placeholder="매물명/동호/평형/가격 검색 (예: 반포 205-1001 33평 25억)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
              />
              <button
                type="button"
                disabled={searching}
                onClick={handleSearch}
                className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {searching ? "검색중..." : "검색"}
              </button>
            </div>
            <div className="mt-3 max-h-[380px] overflow-y-auto space-y-2">
              {searchResults.length === 0 ? <p className="text-sm text-neutral-500">검색 결과가 없습니다.</p> : null}
              {searchResults.map((r) => {
                const checked = selectedIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => (checked ? handleRemoveId(r.id) : handleSelectId(r.id))}
                    className={`w-full rounded-xl border px-3 py-2 text-left hover:bg-neutral-50 ${checked ? "border-emerald-500" : "border-neutral-200"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-900">{r.complex || r.id}</p>
                        <p className="text-xs text-neutral-500">
                          {[r.unit || [r.dong, r.ho].filter(Boolean).join("-"), r.py ? `${r.py}평` : null, r.type].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-neutral-900">{formatPrice(r.price)}</p>
                      {r.monthly ? <p className="text-xs text-neutral-500">{formatPrice(r.monthly)}</p> : null}
                      <span className="text-[11px] font-semibold text-emerald-600">{checked ? "선택됨" : "추가"}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          </div>
        </div>
      </div>
    </AdminFrame>
  );
}
