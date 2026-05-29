// src/pages/admin/AdminDashboards.tsx
// ═══════════════════════════════════════════════════════════════════════════
// Layout sidebar + contenu — avec toggle sombre/clair
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState,
  useEffect,
  memo,
  useCallback,
  createContext,
  useContext,
} from "react";
import {
  FiGrid,
  FiPackage,
  FiTag,
  FiShoppingBag,
  FiCpu,
  FiUsers,
  FiZap,
  FiLogOut,
  FiChevronRight,
  FiSun,
  FiMoon,
  FiMenu,
  FiX,
} from "react-icons/fi";

import ProductsTab from "./ProductsTab";
import CategoriesTab from "./CategoriesTab";
import OrdersTab from "./OrdersTab";
import DashboardTab from "./DashboardTab";
import AnalyticDashboard from "./AnalyticDashboard";
import SegmentDashboard from "./SegmentationDashboard";
import ForeSysDashboard from "./ForeSysDashboard";

import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "../../store";
import {
  fetchMLHealth,
  selectRecSysLoaded,
  selectSegSysLoaded,
  selectMLHealthLoading,
} from "../../store/slices/mlSlice";
import {
  fetchForecastHealth,
  selectForecastHealth,
} from "../../store/slices/forecastSlice";

// ── Palettes thème ───────────────────────────────────────────────────────────
export const DARK_THEME = {
  bg: "#0B1120",
  sidebar: "#0F172A",
  border: "#1E293B",
  active: "#1E293B",
  hoverBg: "#1E293B88",
  text: "#F1F5F9",
  muted: "#64748B",
  accent: "#6366F1",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  card: "#0F172A",
  inputBg: "#1E293B",
  cyan: "#06B6D4",
  recsys: "#8B5CF6",
  behasys: "#10B981",
  foresys: "#6366F1",
  isDark: true,
};

export const LIGHT_THEME = {
  bg: "#F1F5F9",
  sidebar: "#FFFFFF",
  border: "#E2E8F0",
  active: "#EEF2FF",
  hoverBg: "#F1F5F9",
  text: "#0F172A",
  muted: "#64748B",
  accent: "#6366F1",
  success: "#059669",
  warning: "#D97706",
  danger: "#DC2626",
  card: "#FFFFFF",
  inputBg: "#F8FAFC",
  cyan: "#0891B2",
  recsys: "#8B5CF6",
  behasys: "#10B981",
  foresys: "#6366F1",
  isDark: false,
};

export type AdminTheme = typeof DARK_THEME;

// ── Context thème ─────────────────────────────────────────────────────────────
export const AdminThemeCtx = createContext<AdminTheme>(DARK_THEME);
export const useAdminTheme = () => useContext(AdminThemeCtx);

type AdminTab =
  | "dashboard"
  | "products"
  | "categories"
  | "orders"
  | "recsys"
  | "behasys"
  | "foresys";

// ── Dot de statut ─────────────────────────────────────────────────────────────
const Dot = memo(({ ok, loading }: { ok: boolean; loading: boolean }) => (
  <span
    style={{
      width: 7,
      height: 7,
      borderRadius: "50%",
      display: "inline-block",
      flexShrink: 0,
      background: loading ? "#F59E0B" : ok ? "#10B981" : "#EF4444",
      boxShadow: `0 0 6px ${loading ? "#F59E0B" : ok ? "#10B981" : "#EF4444"}88`,
      animation: loading ? "pulse 1.5s infinite" : "none",
    }}
  />
));

// ── Nav Item ──────────────────────────────────────────────────────────────────
interface NavItemProps {
  id: AdminTab;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: string;
  badgeColor?: string;
  statusDot?: React.ReactNode;
  onClick: (id: AdminTab) => void;
  T: AdminTheme;
}

const NavItem = memo(
  ({
    id,
    label,
    icon,
    active,
    badge,
    badgeColor,
    statusDot,
    onClick,
    T,
  }: NavItemProps) => {
    const [hovered, setHovered] = useState(false);
    const accentColor =
      id === "recsys"
        ? "#8B5CF6"
        : id === "behasys"
          ? "#10B981"
          : id === "foresys"
            ? "#6366F1"
            : T.accent;

    return (
      <button
        onClick={() => onClick(id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderRadius: 10,
          border: "none",
          cursor: "pointer",
          background: active ? T.active : hovered ? T.hoverBg : "transparent",
          color: active ? T.text : T.muted,
          fontWeight: active ? 700 : 500,
          fontSize: 14,
          textAlign: "left",
          transition: "all 0.15s",
          borderLeft: active
            ? `3px solid ${accentColor}`
            : "3px solid transparent",
          marginBottom: 2,
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1, whiteSpace: "nowrap" }}>{label}</span>
        {statusDot && statusDot}
        {badge && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: "2px 7px",
              borderRadius: 20,
              background: badgeColor ?? `${T.accent}33`,
              color: badgeColor ? "white" : T.accent,
            }}
          >
            {badge}
          </span>
        )}
        {active && (
          <FiChevronRight size={12} style={{ flexShrink: 0, opacity: 0.5 }} />
        )}
      </button>
    );
  },
);

// ── Section label ─────────────────────────────────────────────────────────────
const SectionLabel = ({ label, T }: { label: string; T: AdminTheme }) => (
  <p
    style={{
      fontSize: 10,
      color: T.muted,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      padding: "0 8px",
      marginBottom: 6,
      marginTop: 8,
    }}
  >
    {label}
  </p>
);

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminDashboards() {
  const [active, setActive] = useState<AdminTab>("dashboard");
  const [isDark, setIsDark] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const T = isDark ? DARK_THEME : LIGHT_THEME;

  const dispatch = useDispatch<AppDispatch>();
  const recLoaded = useSelector(selectRecSysLoaded);
  const segLoaded = useSelector(selectSegSysLoaded);
  const mlLoading = useSelector(selectMLHealthLoading);
  const fHealth = useSelector(selectForecastHealth);

  useEffect(() => {
    dispatch(fetchMLHealth());
    dispatch(fetchForecastHealth());
  }, [dispatch]);

  const go = useCallback((id: AdminTab) => {
    setActive(id);
    setSidebarOpen(false);
  }, []);

  const foreLoaded = fHealth?.forecast_loaded ?? false;

  const sidebarContent = (
    <>
      {/* Logo + toggle */}
      <div
        style={{
          padding: "4px 8px 16px",
          borderBottom: `1px solid ${T.border}`,
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              color: T.text,
            }}
          >
            Smart<span style={{ color: T.accent }}>Shop</span>
          </div>
          <div
            style={{
              fontSize: 10,
              color: T.muted,
              fontWeight: 600,
              letterSpacing: "0.08em",
              marginTop: 2,
            }}
          >
            ADMIN CONSOLE
          </div>
        </div>
        {/* Dark/Light toggle */}
        <button
          onClick={() => setIsDark(!isDark)}
          title={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            background: T.active,
            color: isDark ? "#F59E0B" : "#6366F1",
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 0.2s",
          }}
        >
          {isDark ? <FiSun size={14} /> : <FiMoon size={14} />}
        </button>
      </div>

      {/* Vue d'ensemble */}
      <div style={{ marginBottom: 8 }}>
        <SectionLabel label="Vue d'ensemble" T={T} />
        <NavItem
          id="dashboard"
          label="Dashboard"
          icon={<FiGrid />}
          active={active === "dashboard"}
          onClick={go}
          T={T}
        />
      </div>

      {/* E-Commerce */}
      <div style={{ marginBottom: 8 }}>
        <SectionLabel label="E-Commerce" T={T} />
        <NavItem
          id="products"
          label="Produits"
          icon={<FiPackage />}
          active={active === "products"}
          onClick={go}
          T={T}
        />
        <NavItem
          id="categories"
          label="Catégories"
          icon={<FiTag />}
          active={active === "categories"}
          onClick={go}
          T={T}
        />
        <NavItem
          id="orders"
          label="Commandes"
          icon={<FiShoppingBag />}
          active={active === "orders"}
          onClick={go}
          T={T}
        />
      </div>

      {/* Intelligence ML */}
      <div style={{ flex: 1 }}>
        <SectionLabel label="Intelligence ML" T={T} />
        <NavItem
          id="recsys"
          label="RecSys"
          icon={<FiCpu />}
          active={active === "recsys"}
          onClick={go}
          T={T}
          badge="S3"
          badgeColor="#8B5CF6"
          statusDot={<Dot ok={recLoaded} loading={mlLoading} />}
        />
        <NavItem
          id="behasys"
          label="BehaSys"
          icon={<FiUsers />}
          active={active === "behasys"}
          onClick={go}
          T={T}
          badge="S4"
          badgeColor="#10B981"
          statusDot={<Dot ok={segLoaded} loading={mlLoading} />}
        />
        <NavItem
          id="foresys"
          label="ForeSys"
          icon={<FiZap />}
          active={active === "foresys"}
          onClick={go}
          T={T}
          badge="S5"
          badgeColor="#6366F1"
          statusDot={<Dot ok={foreLoaded} loading={false} />}
        />
      </div>

      {/* Bas de sidebar */}
      <div
        style={{
          borderTop: `1px solid ${T.border}`,
          paddingTop: 12,
          marginTop: 8,
        }}
      >
        {/* Indicateur thème actif */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 8,
            background: T.active,
            marginBottom: 8,
            cursor: "pointer",
          }}
          onClick={() => setIsDark(!isDark)}
        >
          <span style={{ fontSize: 12, color: T.muted }}>
            {isDark ? <FiMoon size={12} /> : <FiSun size={12} />}
          </span>
          <span style={{ fontSize: 11, color: T.muted, flex: 1 }}>
            Mode {isDark ? "sombre" : "clair"}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 20,
              background: isDark ? "#1E293B" : "#EEF2FF",
              color: isDark ? "#64748B" : "#6366F1",
              border: `1px solid ${T.border}`,
            }}
          >
            {isDark ? "DARK" : "LIGHT"}
          </span>
        </div>

        <div
          style={{
            padding: "8px 10px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              color: "white",
              flexShrink: 0,
            }}
          >
            A
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>
              Admin
            </div>
            <div style={{ fontSize: 10, color: T.muted }}>SmartShop</div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <AdminThemeCtx.Provider value={T}>
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          background: T.bg,
          fontFamily: "'Inter', -apple-system, sans-serif",
          color: T.text,
          transition: "background 0.2s, color 0.2s",
          position: "relative",
        }}
      >
        {/* ── SIDEBAR DESKTOP ─────────────────────────────────────────────── */}
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            background: T.sidebar,
            borderRight: `1px solid ${T.border}`,
            display: "flex",
            flexDirection: "column",
            padding: "20px 12px",
            position: "sticky",
            top: 0,
            height: "100vh",
            overflowY: "auto",
            transition: "background 0.2s, border-color 0.2s",
            zIndex: 10,
          }}
          className="admin-sidebar-desktop"
        >
          {sidebarContent}
        </aside>

        {/* ── SIDEBAR MOBILE (drawer) ──────────────────────────────────────── */}
        {sidebarOpen && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex" }}
          >
            <div
              style={{ flex: 1, background: "rgba(0,0,0,0.5)" }}
              onClick={() => setSidebarOpen(false)}
            />
            <div
              style={{
                width: 240,
                background: T.sidebar,
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                padding: "20px 12px",
                overflowY: "auto",
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                borderRight: `1px solid ${T.border}`,
              }}
            >
              {sidebarContent}
            </div>
          </div>
        )}

        {/* ── CONTENU PRINCIPAL ─────────────────────────────────────────────── */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            minWidth: 0,
            height: "100vh",
            scrollbarWidth: "thin",
            scrollbarColor: `${T.border} transparent`,
          }}
        >
          {/* Topbar mobile */}
          <div
            className="admin-topbar-mobile"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              borderBottom: `1px solid ${T.border}`,
              background: T.sidebar,
              position: "sticky",
              top: 0,
              zIndex: 20,
            }}
          >
            <button
              title="Menu"
              onClick={() => setSidebarOpen(true)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: T.text,
                padding: 4,
              }}
            >
              <FiMenu size={20} />
            </button>
            <span style={{ fontWeight: 800, fontSize: 15, color: T.text }}>
              Smart<span style={{ color: T.accent }}>Shop</span>
              <span
                style={{
                  color: T.muted,
                  fontWeight: 400,
                  fontSize: 12,
                  marginLeft: 8,
                }}
              >
                Admin
              </span>
            </span>
            <button
              onClick={() => setIsDark(!isDark)}
              style={{
                marginLeft: "auto",
                background: "none",
                border: `1px solid ${T.border}`,
                cursor: "pointer",
                color: isDark ? "#F59E0B" : "#6366F1",
                padding: "6px 8px",
                borderRadius: 8,
              }}
            >
              {isDark ? <FiSun size={14} /> : <FiMoon size={14} />}
            </button>
          </div>

          {active === "dashboard" && <DashboardTab onNavigate={go} />}
          {active === "products" && <ProductsTab />}
          {active === "categories" && <CategoriesTab />}
          {active === "orders" && <OrdersTab />}
          {active === "recsys" && <AnalyticDashboard />}
          {active === "behasys" && <SegmentDashboard />}
          {active === "foresys" && <ForeSysDashboard />}
        </main>

        <style>{`
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
          .admin-sidebar-desktop { display: flex !important; flex-direction: column; }
          @media (max-width: 767px) { .admin-sidebar-desktop { display: none !important; } }
          .admin-topbar-mobile { display: flex !important; }
          @media (min-width: 768px) { .admin-topbar-mobile { display: none !important; } }
          /* Custom scrollbar for admin main content */
          main::-webkit-scrollbar { width: 6px; }
          main::-webkit-scrollbar-track { background: transparent; }
          main::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
          main::-webkit-scrollbar-thumb:hover { background: ${T.muted}; }
          /* Sidebar scrollbar */
          aside::-webkit-scrollbar { width: 4px; }
          aside::-webkit-scrollbar-track { background: transparent; }
          aside::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }

          ${
            !isDark
              ? `
          /* ── LIGHT MODE — ML dashboards colour override ──────────────────── */
          .ml-dashboard-root .bg-gognet-dark,
          .ml-dashboard-root [class*="bg-gognet-dark"] { background-color: #F1F5F9 !important; }

          .ml-dashboard-root .bg-gognet-navy,
          .ml-dashboard-root [class*="bg-gognet-navy"],
          .ml-dashboard-root .bg-gognet-navy-mid { background-color: #FFFFFF !important; }

          .ml-dashboard-root .border-gognet-border-dark,
          .ml-dashboard-root [class*="border-gognet-border-dark"],
          .ml-dashboard-root [class*="border-white\\/10"],
          .ml-dashboard-root [class*="border-white\\/5"] { border-color: #E2E8F0 !important; }

          .ml-dashboard-root .text-white { color: #0F172A !important; }
          .ml-dashboard-root .text-slate-300,
          .ml-dashboard-root .text-slate-400,
          .ml-dashboard-root .text-slate-500 { color: #64748B !important; }
          .ml-dashboard-root .text-slate-600 { color: #475569 !important; }

          .ml-dashboard-root [class*="bg-white\\/5"],
          .ml-dashboard-root [class*="bg-white\\/10"],
          .ml-dashboard-root [class*="bg-slate-800"],
          .ml-dashboard-root [class*="bg-slate-900"],
          .ml-dashboard-root [class*="bg-\\[#0F172A\\]"],
          .ml-dashboard-root [class*="bg-\\[#1E293B\\]"] { background-color: #F8FAFC !important; }

          .ml-dashboard-root [class*="bg-white\\/3"] { background-color: #F1F5F9 !important; }

          /* Recharts overrides for light mode */
          .ml-dashboard-root .recharts-cartesian-grid line { stroke: #E2E8F0 !important; }
          .ml-dashboard-root .recharts-text { fill: #64748B !important; }
          .ml-dashboard-root .recharts-tooltip-wrapper .recharts-default-tooltip { 
            background: #FFFFFF !important; border-color: #E2E8F0 !important;
            color: #0F172A !important;
          }
          /* Inline hardcoded dark colors → light */
          .ml-dashboard-root [style*="#0B1120"],
          .ml-dashboard-root [style*="0B1120"] { background-color: #F1F5F9 !important; }
          .ml-dashboard-root [style*="#0F172A"] { background-color: #FFFFFF !important; }
          .ml-dashboard-root [style*="#1E293B"] { background-color: #F8FAFC !important; border-color: #E2E8F0 !important; }
          .ml-dashboard-root [style*="color: #F1F5F9"],
          .ml-dashboard-root [style*="color:#F1F5F9"],
          .ml-dashboard-root [style*="color: rgb(241"] { color: #0F172A !important; }
          .ml-dashboard-root [style*="color: #64748B"],
          .ml-dashboard-root [style*="color:#64748B"] { color: #64748B !important; }
          `
              : ""
          }
        `}</style>
      </div>
    </AdminThemeCtx.Provider>
  );
}
