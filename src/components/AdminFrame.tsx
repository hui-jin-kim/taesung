import React from "react";
import { useAuth } from "../context/AuthContext";
import AppNavbar from "./AppNavbar";

export default function AdminFrame({ children, title }: { children: React.ReactNode; title?: string }) {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-neutral-50">
      <AppNavbar />
      <main className="px-6 py-6">
        <div className="max-w-7xl mx-auto">
          {title ? <h1 className="mb-4 text-2xl font-bold">{title}</h1> : null}
          {children}
        </div>
      </main>
    </div>
  );
}
