import React from "react";
import AdminFrame from "../components/AdminFrame";

type AgencyProfile = {
  name: string;
  representative?: string;
  logoUrl?: string;
  phones: string[];
  address?: string;
  businessNo?: string;
  ctaText?: string;
  ctaLink?: string;
};

const STORAGE_KEY = "rj_agency_profile";

function load(): AgencyProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { name: "", phones: [] };
    const obj = JSON.parse(raw);
    return { name: "", phones: [], ...(obj || {}) } as AgencyProfile;
  } catch { return { name: "", phones: [] }; }
}

function save(p: AgencyProfile) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
}

export default function AdminAgency() {
  const [profile, setProfile] = React.useState<AgencyProfile>(() => load());
  const [saved, setSaved] = React.useState<string>("");

  function onSave() {
    save(profile);
    setSaved(new Date().toLocaleString());
  }

  return (
    <AdminFrame title="중개업소 정보">
      <div className="max-w-3xl space-y-4">
        <div className="bg-white rounded-2xl border p-4 space-y-3">
          <div>
            <label className="block text-sm text-neutral-700">상호</label>
            <input className="mt-1 w-full border rounded px-3 py-2" value={profile.name} onChange={(e)=>setProfile({...profile, name: e.target.value})} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-neutral-700">대표자</label>
              <input className="mt-1 w-full border rounded px-3 py-2" value={profile.representative || ''} onChange={(e)=>setProfile({...profile, representative: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-neutral-700">사업자등록번호</label>
              <input className="mt-1 w-full border rounded px-3 py-2" value={profile.businessNo || ''} onChange={(e)=>setProfile({...profile, businessNo: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm text-neutral-700">로고 URL</label>
            <input className="mt-1 w-full border rounded px-3 py-2" value={profile.logoUrl || ''} onChange={(e)=>setProfile({...profile, logoUrl: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-neutral-700">연락처(줄바꿈 구분)</label>
            <textarea className="mt-1 w-full border rounded px-3 py-2" rows={3} value={(profile.phones || []).join('\n')} onChange={(e)=>setProfile({...profile, phones: e.target.value.split(/\r?\n/).filter(Boolean)})} />
          </div>
          <div>
            <label className="block text-sm text-neutral-700">주소</label>
            <input className="mt-1 w-full border rounded px-3 py-2" value={profile.address || ''} onChange={(e)=>setProfile({...profile, address: e.target.value})} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-neutral-700">CTA 문구</label>
              <input className="mt-1 w-full border rounded px-3 py-2" value={profile.ctaText || ''} onChange={(e)=>setProfile({...profile, ctaText: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-neutral-700">CTA 링크</label>
              <input className="mt-1 w-full border rounded px-3 py-2" value={profile.ctaLink || ''} onChange={(e)=>setProfile({...profile, ctaLink: e.target.value})} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button className="rounded-md bg-blue-600 text-white text-sm px-3 py-1.5" onClick={onSave}>저장</button>
          </div>
          {saved ? <div className="text-xs text-neutral-500">저장됨: {saved}</div> : null}
        </div>
      </div>
    </AdminFrame>
  );
}

