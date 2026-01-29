// src/components/Badge.tsx
// 역할: 간단 배지 컴포넌트
import React from "react";

export default function Badge({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200"
      aria-label={title}
      title={title}
    >
      {children}
    </span>
  );
}

