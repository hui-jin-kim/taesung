import React from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/AppNavbar";

import Listings from "../pages/ListingsPage";
import LeadListPage from "../pages/LeadListPage";
import CompletedListings from "../pages/CompletedListings";
import OurDeals from "../pages/OurDeals";
import Buyers from "../pages/Buyers";
import BuyerDetail from "../pages/BuyerDetail";
import Selected from "../pages/Selected";
import Admin from "../pages/Admin";
import AdminDashboard from "../pages/AdminDashboard";
import AdminAlerts from "../pages/AdminAlerts";
import AdminAgency from "../pages/AdminAgency";
import AdminCurations from "../pages/AdminCurations";
import AdminSettings from "../pages/AdminSettings";
import ListingDetail from "../pages/ListingDetail";
import Login from "../pages/Login";
import ExpiryCenter from "../pages/ExpiryCenter";
import Trash from "../pages/Trash";
import { useAuth } from "../context/AuthContext";
import useUserActivityTracker from "../hooks/useUserActivityTracker";

const STAFF_HOME = "/listings";

function StaffOnly({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuth();
  const loc = useLocation();
  if (!initialized) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  const role = (user as any)?.role;
  if (role === "viewer") return <ForbiddenClean />;
  if (role === "owner" || role === "admin" || role === "staff" || !role) return <>{children}</>;
  return <ForbiddenClean />;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuth();
  const loc = useLocation();
  if (!initialized) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;

  const env: any = (import.meta as any)?.env || {};
  const ownerEmails = String(env.VITE_SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);
  const adminEmails = String(env.VITE_ADMIN_EMAILS || "")
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);
  const email = String(user.email || "").toLowerCase();
  const role = (user as any)?.role;
  const emailAllowed = ownerEmails.includes(email) || adminEmails.includes(email);

  if (role === "owner" || role === "admin" || (!role && emailAllowed)) return <>{children}</>;
  return <ForbiddenClean />;
}

function HomeRedirect() {
  const { user, initialized } = useAuth();
  if (!initialized) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={STAFF_HOME} replace />;
}

function Forbidden() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-bold mb-2">접근 권한이 없습니다</h1>
        <p className="text-neutral-600 text-sm">관리자 전용 페이지입니다.</p>
        <div className="mt-4 text-sm text-neutral-500">
          현재 사용자 <span className="font-mono">{user?.email ?? "-"}</span>
          {(user as any)?.role ? <span className="ml-2">(role: {(user as any).role})</span> : null}
        </div>
      </div>
    </div>
  );
}

function ForbiddenClean() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-bold mb-2">접근 권한이 없습니다</h1>
        <p className="text-neutral-600 text-sm">관리자 전용 페이지입니다.</p>
        <div className="mt-4 text-sm text-neutral-500">
          현재 사용자 <span className="font-mono">{user?.email ?? "-"}</span>
          {(user as any)?.role ? <span className="ml-2">(role: {(user as any).role})</span> : null}
        </div>
      </div>
    </div>
  );
}

export default function AppRoutes() {
  useUserActivityTracker();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const role = (user as any)?.role;

  React.useEffect(() => {
    if (!user) return;
    const isStaffOrAdmin = role === "owner" || role === "admin" || role === "staff";
    if (!isStaffOrAdmin) return;
    const seenFlag = sessionStorage.getItem("staffLandingSeen");
    if (location.pathname !== "/listings" && !seenFlag) {
      sessionStorage.setItem("staffLandingSeen", "1");
      navigate("/listings", { replace: true });
    }
  }, [user, role, location.pathname, navigate]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route
        path="/lead-list"
        element={
          <StaffOnly>
            <LeadListPage />
          </StaffOnly>
        }
      />
      <Route
        path="/listings"
        element={
          <StaffOnly>
            <Listings />
          </StaffOnly>
        }
      />
      <Route
        path="/listing/:id"
        element={
          <StaffOnly>
            <ListingDetail />
          </StaffOnly>
        }
      />
      <Route
        path="/expiry"
        element={
          <StaffOnly>
            <ExpiryCenter />
          </StaffOnly>
        }
      />
      <Route
        path="/completed"
        element={
          <StaffOnly>
            <CompletedListings />
          </StaffOnly>
        }
      />
      <Route
        path="/our-deals"
        element={
          <StaffOnly>
            <OurDeals />
          </StaffOnly>
        }
      />
      <Route
        path="/buyers"
        element={
          <StaffOnly>
            <Buyers />
          </StaffOnly>
        }
      />
      <Route
        path="/buyers/:id"
        element={
          <StaffOnly>
            <BuyerDetail />
          </StaffOnly>
        }
      />
      <Route
        path="/selected"
        element={
          <StaffOnly>
            <Selected />
          </StaffOnly>
        }
      />
      <Route
        path="/trash"
        element={
          <StaffOnly>
            <Trash />
          </StaffOnly>
        }
      />
      <Route
        path="/admin/alerts"
        element={
          <AdminOnly>
            <AdminAlerts />
          </AdminOnly>
        }
      />
      <Route
        path="/admin/curations"
        element={
          <AdminOnly>
            <AdminCurations />
          </AdminOnly>
        }
      />
      <Route
        path="/admin/agency"
        element={
          <AdminOnly>
            <AdminAgency />
          </AdminOnly>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <AdminOnly>
            <AdminSettings />
          </AdminOnly>
        }
      />
      <Route
        path="/admin/tools"
        element={
          <AdminOnly>
            <Admin />
          </AdminOnly>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminOnly>
            <AdminDashboard />
          </AdminOnly>
        }
      />
      <Route path="*" element={<Navigate to={STAFF_HOME} replace />} />
    </Routes>
  );
}