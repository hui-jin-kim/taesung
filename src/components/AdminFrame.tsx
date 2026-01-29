import React from "react";
import AdminSidebar from "./AdminSidebar";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminFrame({ children, title }: { children: React.ReactNode; title?: string }) {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-neutral-50 flex">
      <AdminSidebar />
      <main className="flex-1 px-6 py-6">
        <div className="mb-3 flex items-center justify-end gap-2">
          <Link to="/admin" className="text-sm px-2 py-1 rounded border bg-white hover:bg-neutral-50">
            관리자 홈
          </Link>
          <Link to="/listings" className="text-sm px-2 py-1 rounded border bg-white hover:bg-neutral-50">
            매물 목록
          </Link>
          <button
            onClick={logout}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-50"
            aria-label="로그아웃"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 3v8" />
              <path d="M8.21 5.21a7 7 0 1 0 7.58 0" />
            </svg>
          </button>
        </div>
        {title ? <h1 className="mb-4 text-2xl font-bold">{title}</h1> : null}
        {children}
      </main>
    </div>
  );
}