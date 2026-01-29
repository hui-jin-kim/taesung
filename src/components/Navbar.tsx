import { Link, useLocation } from "react-router-dom";
import { useSelectionSummary } from "../context/SelectionContext";

export default function Navbar() {
  const loc = useLocation();
  const { selected } = useSelectionSummary();

  function Tab({ to, label }: { to: string; label: string }) {
    const active = loc.pathname.startsWith(to);
    const cls = active ? "bg-neutral-900 text-white" : "bg-white text-neutral-800 ring-1 ring-neutral-200";
    return (
      <Link to={to} className={`px-2.5 sm:px-3 py-2 rounded-lg text-xs sm:text-sm ${cls}`}>
        {label}
      </Link>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-neutral-50/70 backdrop-blur">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-12 sm:h-14">
        <Link to="/" className="font-bold">MJ Real Estate</Link>
        <nav className="flex items-center gap-2 overflow-x-auto">
          <Tab to="/listings" label="목록" />
          <Tab to="/new" label="등록" />
          <Tab to="/selected" label={`선택매물 (${selected.length})`} />
          <Tab to="/admin" label="관리" />
        </nav>
      </div>
    </header>
  );
}
