import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import InstallAppModal from "../components/InstallAppModal";
import { addPwaInstalledListener, shouldShowInstallCTA } from "../lib/pwaInstall";

const STAFF_HOME = "/listings";

export default function Login() {
  const { login, user, initialized } = useAuth();
  const nav = useNavigate();

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [showAdmin, setShowAdmin] = useState(true);

  const [showInstallCTA, setShowInstallCTA] = useState(() => shouldShowInstallCTA());
  const [showInstallModal, setShowInstallModal] = useState(false);

  const destination = useMemo(() => STAFF_HOME, []);

  useEffect(() => {
    if (!initialized || !user) return;
    nav(destination, { replace: true });
  }, [user, initialized, destination, nav]);

  useEffect(() => {
    const cleanup = addPwaInstalledListener(() => setShowInstallCTA(false));
    return cleanup;
  }, []);

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAdminError("");
    setAdminLoading(true);
    const res = await login(adminEmail.trim(), adminPassword);
    setAdminLoading(false);
    if (!res.ok) setAdminError(res.error);
  }

  return (
    <div className="min-h-screen bg-[#f6f2ea] text-neutral-900">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <div className="relative overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)]">
          <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-gradient-to-br from-[#ffcb3f] via-[#ff9e2c] to-[#ff6b3d] opacity-30" />
          <div className="absolute -bottom-20 -left-10 h-60 w-60 rounded-full bg-gradient-to-tr from-[#111827] via-[#374151] to-[#9ca3af] opacity-20" />

          <div className="relative space-y-8 px-6 py-8 sm:px-10 sm:py-10">
            <header className="space-y-3">
              <div className="inline-flex items-center gap-3 rounded-full bg-[#111827] px-4 py-2 text-xs font-semibold tracking-[0.2em] text-[#ffcb3f]">
                TAESUNG REAL ESTATE
              </div>
              <h1 className="text-3xl font-black tracking-tight text-neutral-900 sm:text-4xl">
                태성부동산 매물장
              </h1>
              <p className="text-sm text-neutral-600 sm:text-base">
                스태프 전용 업무 시스템 · 안전한 매물 관리
              </p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-[#ffcb3f] px-3 py-1 font-semibold text-[#4b2e00]">
                  02-533-8500
                </span>
                <span className="rounded-full bg-neutral-100 px-3 py-1 font-semibold text-neutral-700">
                  eguns76@gmail.com
                </span>
              </div>
            </header>

            <section className="rounded-2xl border border-neutral-200 bg-white/80 p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-neutral-900">관리자 로그인</h2>
                <button
                  type="button"
                  onClick={() => setShowAdmin((v) => !v)}
                  className="text-xs font-semibold text-neutral-500 hover:text-neutral-900"
                >
                  {showAdmin ? "접기" : "열기"}
                </button>
              </div>

              {showAdmin && (
                <form className="mt-4 space-y-3" onSubmit={handleAdminLogin}>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="h-12 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/40"
                    placeholder="이메일"
                    required
                  />
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="h-12 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/40"
                    placeholder="비밀번호"
                    required
                  />
                  {adminError && <p className="text-xs text-rose-600">{adminError}</p>}
                  <button
                    disabled={adminLoading}
                    type="submit"
                    className="h-12 w-full rounded-xl bg-[#ffcb3f] font-semibold text-neutral-900 transition-colors hover:bg-[#ffb71f] disabled:opacity-60"
                  >
                    {adminLoading ? "로그인 중..." : "로그인"}
                  </button>
                </form>
              )}
            </section>

            {showInstallCTA ? (
              <button
                type="button"
                onClick={() => setShowInstallModal(true)}
                className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-left transition hover:border-neutral-300"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg text-[#ff9e2c]">
                  +
                </span>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-neutral-500">앱 설치 안내</p>
                  <p className="text-base font-semibold text-neutral-900">홈 화면에 추가</p>
                  <p className="text-xs text-neutral-500">빠른 접속을 위해 설치를 권장합니다.</p>
                </div>
                <span className="text-xs font-semibold text-neutral-400">보기</span>
              </button>
            ) : null}

            <footer className="space-y-1 text-center text-[11px] text-neutral-400">
              <p>© {new Date().getFullYear()} 태성부동산. All rights reserved.</p>
            </footer>
          </div>
        </div>
      </div>

      <InstallAppModal
        open={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        onInstalled={() => setShowInstallCTA(false)}
      />
    </div>
  );
}