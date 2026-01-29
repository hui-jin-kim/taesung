import React, { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, Trash2 } from "lucide-react";
import { useSelectionSummary } from "../context/SelectionContext";
import { useAuth } from "../context/AuthContext";
import { useListings } from "../state/useListings";
import { useSettings } from "../lib/settings";
import { useTrashBuyers } from "../state/useBuyers";
import { useUserDirectory } from "../state/useUserDirectory";

type TabProps = { to: string; label: string; badge?: string };

export default function AppNavbar() {
  const loc = useLocation();
  const isLogin = loc.pathname.startsWith("/login");
  if (isLogin) {
    return (
      <header className="sticky top-0 z-40 bg-neutral-50/70 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-3">
          <Link to="/" className="font-bold text-sm sm:text-base whitespace-nowrap">
            태성부동산 매물장
          </Link>
        </div>
      </header>
    );
  }

  return <LoggedInNavbar locPathname={loc.pathname} />;
}

function LoggedInNavbar({ locPathname }: { locPathname: string }) {
  const nav = useNavigate();
  const { selected } = useSelectionSummary();
  const { settings } = useSettings();
  const { user, logout } = useAuth();
  const listings = useListings();
  const trashBuyers = useTrashBuyers();
  const role = (user as any)?.role;
  const { getName } = useUserDirectory();
  const rawDisplayName = (user as any)?.displayName;
  const photoURL = (user as any)?.photoURL;
  const profileName = React.useMemo(() => {
    const nameFromDirectory = getName(user?.uid, user?.email);
    if (nameFromDirectory) return nameFromDirectory;
    if (typeof rawDisplayName === "string" && rawDisplayName.trim()) return rawDisplayName.trim();
    if (typeof user?.email === "string") return user.email.split("@")[0];
    return "사용자";
  }, [getName, user?.uid, user?.email, rawDisplayName, user?.email]);
  const profileEmail = user?.email ?? "";
  const profileInitials = React.useMemo(() => {
    if (photoURL) return "";
    const parts = profileName.split(/\s+/).filter(Boolean);
    if (!parts.length) return (profileEmail[0] || "").toUpperCase();
    const initials = parts.map((part) => part[0].toUpperCase()).slice(0, 2).join("");
    return initials || (profileEmail[0] || "").toUpperCase();
  }, [profileName, profileEmail, photoURL]);

  const tabs: TabProps[] = [
    { to: "/listings", label: "매물" },
    { to: "/buyers", label: "매수자" },
    { to: "/selected", label: "선택", badge: String(selected.length) },
    { to: "/our-deals", label: "거래" },
    { to: "/completed", label: "완료" },
    { to: "/lead-list", label: "명단" },
  ];

  const { ourCount, otherCount, total } = useMemo(() => {
    let our = 0;
    let oth = 0;
    const now = Date.now();
    const days = Number((settings as any)?.expiryAlertDays ?? 90);
    for (const l of listings as any[]) {
      let expiry: number | undefined;
      if (l?.expiryAt) {
        const ms = new Date(String(l.expiryAt)).getTime();
        if (Number.isFinite(ms)) expiry = ms;
      }
      if (!expiry) continue;
      const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= days) {
        if (l?.closedByUs) our++;
        else oth++;
      }
    }
    return { ourCount: our, otherCount: oth, total: our + oth };
  }, [listings, settings]);

  const trashCount = trashBuyers.length;

  return (
    <header className="sticky top-0 z-40 bg-neutral-50/70 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">
        <div className="flex items-center gap-3">
          <Link to="/" className="font-bold text-sm sm:text-base whitespace-nowrap">
            태성부동산 매물장
          </Link>
          <div className="flex-1 min-w-0">
            <div className="overflow-x-auto">
              <nav className="flex items-center gap-1 whitespace-nowrap px-1">
                {tabs.map((tab) => (
                  <Tab key={tab.to} {...tab} activePathname={locPathname} />
                ))}
                {role === "owner" || role === "admin" ? (
                  <Tab to="/admin" label="관리자" activePathname={locPathname} />
                ) : null}
              </nav>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <button className="h-9 w-9 rounded-full border border-neutral-200 bg-white p-[2px] text-xs font-semibold text-neutral-600 sm:hidden">
                {photoURL ? (
                  <img src={photoURL} alt={profileName} className="h-full w-full rounded-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-neutral-100">
                    {profileInitials}
                  </span>
                )}
              </button>
            ) : null}
            {user && (
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-left">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
                  {photoURL ? (
                    <img src={photoURL} alt={profileName} className="h-full w-full object-cover" />
                  ) : (
                    <span>{profileInitials}</span>
                  )}
                </div>
                <div className="leading-tight">
                  <div className="text-[13px] font-semibold text-neutral-900">{profileName}</div>
                  {profileEmail ? <div className="text-[11px] text-neutral-500">{profileEmail}</div> : null}
                </div>
              </div>
            )}
            <Link
              to="/expiry"
              aria-label={`만료 예정 ${total}건 / 우리 거래 ${ourCount}건 / 기타 ${otherCount}건`}
              className="relative px-2 py-2 sm:px-3 sm:py-2 rounded-lg text-sm sm:text-[13px] bg-white ring-1 ring-neutral-200 flex items-center"
            >
              <Bell className="w-4 h-4" />
              {ourCount > 0 ? (
                <span className="ml-1 rounded-full text-emerald-700 bg-emerald-50 text-xs px-1.5">{ourCount}</span>
              ) : null}
              {otherCount > 0 ? (
                <span className="ml-1 rounded-full text-amber-800 bg-amber-100 text-xs px-1.5">{otherCount}</span>
              ) : null}
            </Link>
            <Link
              to="/trash"
              aria-label={`휴지통 매물 ${trashCount}건`}
              className="relative px-2 py-2 sm:px-3 sm:py-2 rounded-lg text-sm sm:text-[13px] bg-white ring-1 ring-neutral-200 flex items-center"
            >
              <Trash2 className="w-4 h-4" />
              {trashCount > 0 ? (
                <span className="ml-1 rounded-full text-neutral-800 bg-neutral-100 text-xs px-1.5">{trashCount}</span>
              ) : null}
            </Link>
            {!user ? (
              <Link
                to="/login"
                className="px-3 py-2 sm:px-3 sm:py-2 rounded-lg text-sm sm:text-[13px] bg-white ring-1 ring-neutral-200"
              >
                로그인
              </Link>
            ) : (
              <button
                onClick={() => {
                  logout();
                  nav("/login");
                }}
                className="flex items-center justify-center h-9 w-9 rounded-full border border-red-200 text-red-600 bg-white hover:bg-red-50"
                aria-label="로그아웃"
              >
                <PowerIcon />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function Tab({ to, label, badge, activePathname }: TabProps & { activePathname: string }) {
  const active = activePathname === to || activePathname.startsWith(`${to}/`);
  const cls = active ? "bg-neutral-900 text-white" : "bg-white text-neutral-800 ring-1 ring-neutral-200";
  return (
    <Link
      to={to}
      className={`px-2.5 sm:px-3 py-2 sm:py-2 rounded-lg text-sm sm:text-[13px] flex items-center gap-1 ${cls}`}
    >
      <span>{label}</span>
      {badge && badge !== "0" ? (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/90 text-neutral-800">{badge}</span>
      ) : null}
    </Link>
  );
}

function PowerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 3v8" />
      <path d="M8.21 5.21a7 7 0 1 0 7.58 0" />
    </svg>
  );
}