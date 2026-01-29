import React from "react";
import AdminFrame from "../components/AdminFrame";
import { getAllFlags, setFlag } from "../services/flags";

export function FeatureFlagPanel() {
  const [flags, setFlags] = React.useState(getAllFlags());

  function update<K extends keyof typeof flags>(key: K, value: (typeof flags)[K]) {
    setFlags((prev) => ({ ...prev, [key]: value }));
    setFlag(key as any, value as any);
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border p-4">
        <h2 className="font-semibold mb-2">공개 기능</h2>
        <label className="block text-sm mb-1">
          <input type="checkbox" className="mr-2" checked={flags.enablePublicDistrict} onChange={(e) => update("enablePublicDistrict", e.target.checked)} /> 지갑 데이터 공개
        </label>
        <label className="block text-sm mb-1">
          <input type="checkbox" className="mr-2" checked={flags.enablePublicViewerMobile} onChange={(e) => update("enablePublicViewerMobile", e.target.checked)} /> 모바일 상세 공개(/listing/:id/mobile)
        </label>
      </div>

      <div className="bg-white rounded-2xl border p-4">
        <h2 className="font-semibold mb-2">관리자 도구</h2>
        <label className="block text-sm mb-2">
          <input type="checkbox" className="mr-2" checked={flags.showAdminToolbar} onChange={(e) => update("showAdminToolbar", e.target.checked)} /> 관리자 툴바 표시
        </label>
        <label className="block text-sm">
          기본 검색어
          <input className="mt-1 w-full border rounded px-3 py-2 text-sm" value={flags.defaultDistrictQuery} onChange={(e) => update("defaultDistrictQuery", e.target.value)} placeholder="예: 메이플자이" />
        </label>
        <div className="mt-3 text-xs text-neutral-500">설정은 로컬 스토리지에 저장됩니다(초기 운영 단계).</div>
      </div>
    </div>
  );
}

export default function AdminSettings() {
  return (
    <AdminFrame title="환경 설정 / 실험">
      <div className="max-w-3xl">
        <FeatureFlagPanel />
      </div>
    </AdminFrame>
  );
}
