import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getFlag } from "../services/flags";

export default function PublicFeatureGate({ flagKey, children }: { flagKey: "enablePublicDistrict" | "enablePublicViewerMobile"; children: React.ReactNode }) {
  const { user, initialized } = useAuth();
  if (!initialized) return null;
  const role = (user as any)?.role;
  const isAdmin = role === "owner" || role === "admin";
  const enabled = getFlag(flagKey);
  if (enabled || isAdmin) return <>{children}</>;
  return <Navigate to="/" replace />;
}
