import React from "react";
import { Link, useLocation } from "react-router-dom";

type NavItemConfig = { to: string; label: string };
type NavSection = { title: string; items: NavItemConfig[] };

function NavItem({ to, label }: NavItemConfig) {
  const loc = useLocation();
  const active = loc.pathname === to || loc.pathname.startsWith(`${to}/`);
  return (
    <Link
      to={to}
      className={`block rounded-md px-3 py-2 text-sm ${
        active ? "bg-neutral-200 text-neutral-900" : "text-neutral-700 hover:bg-neutral-100"
      }`}
    >
      {label}
    </Link>
  );
}

const sections: NavSection[] = [
  {
    title: "기본",
    items: [{ to: "/admin", label: "대시보드" }],
  },
  {
    title: "운영",
    items: [
      { to: "/admin/alerts", label: "알림" },
      { to: "/admin/curations", label: "큐레이션" },
    ],
  },
  {
    title: "중개 설정",
    items: [{ to: "/admin/agency", label: "중개사 관리" }],
  },
  {
    title: "시스템",
    items: [
      { to: "/admin/settings", label: "설정" },
      { to: "/admin/tools", label: "관리 도구" },
    ],
  },
];

export default function AdminSidebar() {
  return (
    <aside className="sticky top-0 h-screen w-60 shrink-0 border-r bg-white py-6 px-4">
      <div className="mb-5 px-2">
        <div className="text-lg font-bold">관리자 메뉴</div>
        <div className="text-xs text-neutral-500">태성부동산 매물장</div>
      </div>
      <nav className="space-y-5">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="mb-1 px-3 text-[11px] uppercase tracking-wide text-neutral-400">{section.title}</div>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}