// src/pages/admin/DashboardTab.tsx
// ═══════════════════════════════════════════════════════════════════════════
// Accueil admin — récapitulatif complet du site + bilan ML
// Redux (mlSlice + forecastSlice) — préfetch au montage
// useMemo / useCallback / memo — optimisation perf
// Recharts — revenus mensuels + annuels
// Bilan RecSys / BehaSys / ForeSys avec métriques réelles
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useCallback, memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "../../store";
import api from "../../services/api";
import { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  FiPackage,
  FiShoppingBag,
  FiUsers,
  FiTag,
  FiArrowUpRight,
  FiArrowRight,
  FiCalendar,
  FiRefreshCw,
} from "react-icons/fi";

import {
  fetchMLHealth,
  selectMLHealth,
  selectMLHealthLoading,
  selectRecSysLoaded,
  selectSegSysLoaded,
} from "../../store/slices/mlSlice";
import {
  fetchForecastMetrics,
  fetchForecastHealth,
  fetchPredictions,
  selectForecastHealth,
  selectForecastMetrics,
  selectForecastKPIs,
  selectDataSource,
} from "../../store/slices/forecastSlice";
import { useAdminTheme } from "./AdminDashboards";

// ── Palette partagée ─────────────────────────────────────────────────────────
const C = {
  bg: "#0B1120",
  card: "#0F172A",
  border: "#1E293B",
  text: "#F1F5F9",
  muted: "#64748B",
  accent: "#6366F1",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  cyan: "#06B6D4",
  recsys: "#8B5CF6",
  behasys: "#10B981",
  foresys: "#6366F1",
};

// ── Utilitaires ───────────────────────────────────────────────────────────────
const fmtCur = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── KPI Card ─────────────────────────────────────────────────────────────────
interface KPIProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color?: string;
  onClick?: () => void;
}
const KPI = memo(
  ({ label, value, sub, icon, color = C.accent, onClick }: KPIProps) => (
    <div
      onClick={onClick}
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: "18px 20px",
        position: "relative",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) =>
        onClick &&
        ((e.currentTarget as HTMLElement).style.borderColor = `${color}66`)
      }
      onMouseLeave={(e) =>
        onClick &&
        ((e.currentTarget as HTMLElement).style.borderColor = C.border)
      }
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${color}, transparent)`,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              color: C.muted,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: 8,
            }}
          >
            {label}
          </p>
          <p
            style={{
              fontSize: 26,
              fontWeight: 800,
              lineHeight: 1,
              color: C.text,
            }}
          >
            {value}
          </p>
          {sub && (
            <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{sub}</p>
          )}
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `${color}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color,
            fontSize: 18,
          }}
        >
          {icon}
        </div>
      </div>
      {onClick && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color,
            fontWeight: 600,
          }}
        >
          Voir détail <FiArrowRight size={10} />
        </div>
      )}
    </div>
  ),
);

// ── Tooltip Recharts — uses CSS vars set by DashboardTab root ────────────────
const CT = memo(({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--dash-card, #0B1120)",
        border: `1px solid var(--dash-border, #1E293B)`,
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 12,
        color: "var(--dash-text, #F1F5F9)",
      }}
    >
      <p
        style={{
          color: "var(--dash-accent, #06B6D4)",
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {label}
      </p>
      {payload.map((p: any, i: number) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 2,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: p.color,
              display: "inline-block",
            }}
          />
          <span style={{ color: C.muted }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>
            {typeof p.value === "number"
              ? `${p.value.toLocaleString("fr-FR")} DT`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
});

// ── Bilan ML Card ─────────────────────────────────────────────────────────────
interface MLBilanProps {
  title: string;
  sprint: string;
  algo: string;
  color: string;
  loaded: boolean;
  loading?: boolean;
  metrics: { label: string; value: string | number | null; ok?: boolean }[];
  onNavigate?: () => void;
}
const MLBilan = memo(
  ({
    title,
    sprint,
    algo,
    color,
    loaded,
    loading,
    metrics,
    onNavigate,
  }: MLBilanProps) => (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 20,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: 3,
          background: color,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 14,
        }}
      >
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
            {title}
          </p>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {algo} · <span style={{ color }}>{sprint}</span>
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: loading
                ? `${C.warning}18`
                : loaded
                  ? `${C.success}18`
                  : `${C.danger}18`,
              border: `1px solid ${loading ? C.warning : loaded ? C.success : C.danger}44`,
              borderRadius: 20,
              padding: "3px 10px",
              fontSize: 11,
              fontWeight: 700,
              color: loading ? C.warning : loaded ? C.success : C.danger,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "currentColor",
                display: "inline-block",
                animation: loading ? "pulse 1.5s infinite" : "none",
              }}
            />
            {loading ? "Chargement…" : loaded ? "Opérationnel" : "Hors ligne"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {metrics.map((m) => (
          <div
            key={m.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "7px 10px",
              background: "#ffffff06",
              borderRadius: 8,
            }}
          >
            <span style={{ fontSize: 12, color: C.muted }}>{m.label}</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color:
                  m.value === null || m.value === "N/A" || m.value === "—"
                    ? C.muted
                    : m.ok === true
                      ? C.success
                      : m.ok === false
                        ? C.danger
                        : color,
              }}
            >
              {m.value ?? "—"}
            </span>
          </div>
        ))}
      </div>

      {onNavigate && (
        <button
          onClick={onNavigate}
          style={{
            marginTop: 14,
            width: "100%",
            padding: "8px 0",
            borderRadius: 8,
            border: `1px solid ${color}33`,
            background: `${color}11`,
            color,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          Ouvrir le dashboard <FiArrowUpRight size={12} />
        </button>
      )}
    </div>
  ),
);

// ── Composant principal ───────────────────────────────────────────────────────

interface DashboardTabProps {
  onNavigate?: (tab: any) => void;
}

export default function DashboardTab({ onNavigate }: DashboardTabProps) {
  const T = useAdminTheme();
  // Keep local C alias for backward compat — points to live theme
  const C = T;
  const dispatch = useDispatch<AppDispatch>();

  // Stats locales
  const [siteStats, setSiteStats] = useState({
    orders: 0,
    products: 0,
    revenue: 0,
    users: 0,
    categories: 0,
    pending: 0,
    delivered: 0,
  });
  const [monthlyRevenue, setMonthlyRevenue] = useState<
    { month: string; revenue: number; orders: number }[]
  >([]);
  const [annualRevenue, setAnnualRevenue] = useState<
    { year: number; revenue: number; orders: number }[]
  >([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Redux ML
  const mlHealth = useSelector(selectMLHealth);
  const mlLoading = useSelector(selectMLHealthLoading);
  const recLoaded = useSelector(selectRecSysLoaded);
  const segLoaded = useSelector(selectSegSysLoaded);
  const fHealth = useSelector(selectForecastHealth);
  const fMetrics = useSelector(selectForecastMetrics);
  const fKPIs = useSelector(selectForecastKPIs);
  const fDataSource = useSelector(selectDataSource);

  // Chargement initial
  useEffect(() => {
    dispatch(fetchMLHealth());
    dispatch(fetchForecastHealth());
    dispatch(fetchForecastMetrics());
    dispatch(fetchPredictions(30));
  }, [dispatch]);

  const loadSiteStats = useCallback(async () => {
    setLoading(true);
    try {
      const statsRes = await api
        .get(`/analytics/site-stats/?year=${selectedYear}`)
        .catch(() => ({ data: null }));

      const d = statsRes.data;
      if (d) {
        setSiteStats({
          orders: d.total_orders ?? 0,
          products: d.total_products ?? 0,
          revenue: d.total_revenue ?? 0,
          users: d.total_customers ?? 0,
          categories: d.total_categories ?? 0,
          pending: d.pending_orders ?? 0,
          delivered: d.delivered_orders ?? 0,
        });
        setMonthlyRevenue(d.monthly_revenue ?? []);
        setAnnualRevenue(d.annual_revenue ?? []);
      } else {
        // Fallback léger si endpoint indisponible
        const [prodRes, userRes] = await Promise.all([
          api
            .get("/products/?page_size=1")
            .catch(() => ({ data: { count: 0 } })),
          api
            .get("/auth/admin-stats/")
            .catch(() => ({ data: { total_customers: 0 } })),
        ]);
        setSiteStats({
          orders: 0,
          products: prodRes.data?.count ?? 0,
          revenue: 0,
          users: userRes.data?.total_customers ?? 0,
          categories: 0,
          pending: 0,
          delivered: 0,
        });
      }

      setLastRefresh(new Date());
    } catch (e) {
      console.error("DashboardTab stats error:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadSiteStats();
  }, [loadSiteStats]);

  // CA annuel calculé
  const currentYearRevenue = useMemo(
    () => annualRevenue.find((r) => r.year === selectedYear)?.revenue ?? 0,
    [annualRevenue, selectedYear],
  );

  // Années disponibles
  const years = useMemo(
    () => annualRevenue.map((r) => r.year),
    [annualRevenue],
  );

  // Métriques ML ForeSys
  const foreMetrics = useMemo(
    () => ({
      mape: fMetrics?.MAPE?.value ?? null,
      r2: fMetrics?.R2?.value ?? null,
      mae: fMetrics?.MAE?.value ?? null,
    }),
    [fMetrics],
  );

  const segMetrics = useMemo(() => {
    const seg = mlHealth?.seg_sys;
    if (!seg) return null;
    return seg;
  }, [mlHealth]);

  // ── RENDER ────────────────────────────────────────────────────────────────

  const hdr = (t: string, sub?: string) => (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: 0 }}>
        {t}
      </h2>
      {sub && (
        <p style={{ fontSize: 12, color: C.muted, margin: "4px 0 0" }}>{sub}</p>
      )}
    </div>
  );

  return (
    <div
      className="dashboard-tab-root min-h-screen p-4 sm:p-6 lg:p-8 font-sans space-y-5"
      style={
        {
          background: C.bg,
          color: C.text,
          // CSS vars consumed by CT tooltip (which is outside the component)
          "--dash-card": C.card,
          "--dash-border": C.border,
          "--dash-text": C.text,
          "--dash-muted": C.muted,
          "--dash-accent": C.cyan ?? "#06B6D4",
        } as React.CSSProperties
      }
    >
      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 900,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Vue d'ensemble
          </h1>
          <p style={{ color: C.muted, fontSize: 13, margin: "4px 0 0" }}>
            Tableau de bord principal · Mis à jour{" "}
            {lastRefresh.toLocaleTimeString("fr-FR")}
          </p>
        </div>
        <button
          onClick={loadSiteStats}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 16px",
            background: "transparent",
            border: `1px solid ${C.border}`,
            color: C.muted,
            borderRadius: 10,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          <FiRefreshCw
            size={13}
            style={{ animation: loading ? "spin 1s linear infinite" : "none" }}
          />
          Actualiser
        </button>
      </div>

      {/* ── KPI SITE ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI
          label="Produits actifs"
          value={loading ? "…" : siteStats.products}
          icon={<FiPackage />}
          color={C.cyan}
          sub="en catalogue"
        />
        <KPI
          label="Commandes totales"
          value={loading ? "…" : siteStats.orders}
          icon={<FiShoppingBag />}
          color="#3B82F6"
          sub={`${siteStats.pending} en attente`}
          onClick={() => onNavigate?.("orders")}
        />
        <KPI
          label="Clients enregistrés"
          value={loading ? "…" : siteStats.users}
          icon={<FiUsers />}
          color="#EC4899"
          sub="comptes actifs"
        />
        <KPI
          label="Catégories"
          value={loading ? "…" : siteStats.categories}
          icon={<FiTag />}
          color={C.warning}
          sub="de produits"
        />
        <KPI
          label="CA annuel"
          value={loading ? "…" : fmtCur(currentYearRevenue)}
          // icon={<FiDollarSign />}
          icon="DT"
          color={C.success}
          sub={`${selectedYear}`}
        />
      </div>

      {/* ── GRAPHIQUES REVENUS ────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 18,
          marginBottom: 28,
        }}
      >
        {/* Revenus mensuels */}
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: "20px 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>
                Revenus par mois — {selectedYear}
              </h3>
              <p style={{ color: C.muted, fontSize: 11, margin: "3px 0 0" }}>
                CA mensuel en dinars tunisiens
              </p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: selectedYear === y ? C.accent : "transparent",
                    color: selectedYear === y ? "white" : C.muted,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyRevenue}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.accent} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={C.accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={C.border}
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: C.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: C.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v.toLocaleString("fr-FR")}`}
              />
              <Tooltip content={<CT />} />
              <Area
                dataKey="revenue"
                name="Revenu"
                stroke={C.accent}
                fill="url(#revGrad)"
                strokeWidth={2.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Revenus annuels */}
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: "20px 24px",
          }}
        >
          <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800 }}>
            Revenus annuels
          </h3>
          <p style={{ color: C.muted, fontSize: 11, margin: "0 0 16px" }}>
            Historique complet
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={annualRevenue} barSize={28}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={C.border}
                vertical={false}
              />
              <XAxis
                dataKey="year"
                tick={{ fill: C.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: C.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CT />} />
              <Bar dataKey="revenue" name="Revenu" radius={[4, 4, 0, 0]}>
                {annualRevenue.map((r) => (
                  <Cell
                    key={r.year}
                    fill={r.year === selectedYear ? C.cyan : `${C.accent}88`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── STATS COMMANDES ────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 18,
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: C.muted,
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Commandes en attente
          </p>
          <p style={{ fontSize: 30, fontWeight: 800, color: C.warning }}>
            {siteStats.pending}
          </p>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
            À traiter
          </p>
        </div>
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 18,
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: C.muted,
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Commandes livrées
          </p>
          <p style={{ fontSize: 30, fontWeight: 800, color: C.success }}>
            {siteStats.delivered}
          </p>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
            Complétées
          </p>
        </div>
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 18,
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: C.muted,
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Taux livraison
          </p>
          <p style={{ fontSize: 30, fontWeight: 800, color: C.cyan }}>
            {siteStats.orders > 0
              ? `${Math.round((siteStats.delivered / siteStats.orders) * 100)}%`
              : "—"}
          </p>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
            Des commandes totales
          </p>
        </div>
      </div>

      {/* ── BILAN ML ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        {hdr(
          "Intelligence ML — Bilan des Systèmes",
          "État et performances des modèles entraînés",
        )}
        {/* <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        > */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* RecSys */}
          <MLBilan
            title="RecSys"
            sprint="Sprint S3"
            algo="SVD + NCF Hybride"
            color={C.recsys}
            loaded={recLoaded}
            loading={mlLoading}
            onNavigate={() => onNavigate?.("recsys")}
            metrics={[
              {
                label: "Modèles chargés",
                value: recLoaded ? "✅ SVD + NCF + Cosine" : "❌ Non chargé",
              },
              { label: "Algorithme", value: "Collaborative Filtering" },
              {
                label: "Hybrid α SVD",
                value:
                  mlHealth?.rec_sys?.hybrid_params?.alpha_svd != null
                    ? `${mlHealth.rec_sys.hybrid_params.alpha_svd}`
                    : recLoaded
                      ? "—"
                      : null,
              },
              {
                label: "Fichiers modèles",
                value: recLoaded
                  ? `${Object.values(mlHealth?.rec_sys?.files ?? {}).filter(Boolean).length} / ${Object.keys(mlHealth?.rec_sys?.files ?? {}).length} présents`
                  : "—",
              },
              {
                label: "Statut API",
                value: recLoaded ? "Opérationnel" : "Hors ligne",
                ok: recLoaded,
              },
            ]}
          />

          <MLBilan
            title="BehaSys"
            sprint="Sprint S4"
            algo="RFM + K-Means (k=3)"
            color={C.behasys}
            loaded={segLoaded}
            loading={mlLoading}
            onNavigate={() => onNavigate?.("behasys")}
            metrics={[
              {
                label: "Modèles chargés",
                value: segLoaded ? "✅ K-Means + RFM" : "❌ Non chargé",
              },
              {
                label: "Silhouette Score",
                value:
                  segMetrics?.model_meta?.silhouette != null
                    ? segMetrics.model_meta.silhouette.toFixed(4)
                    : segLoaded
                      ? "—"
                      : null,
                ok: segMetrics?.model_meta?.silhouette
                  ? segMetrics.model_meta.silhouette > 0.4
                  : undefined,
              },
              {
                label: "K optimal (clusters)",
                value:
                  segMetrics?.model_meta?.k != null
                    ? segMetrics.model_meta.k
                    : segLoaded
                      ? 3
                      : null,
              },
              {
                label: "Clients entraînement",
                value:
                  segMetrics?.model_meta?.n_train != null
                    ? segMetrics.model_meta.n_train.toLocaleString()
                    : segLoaded
                      ? "—"
                      : null,
              },
              {
                label: "Statut API",
                value: segLoaded ? "Opérationnel" : "Hors ligne",
                ok: segLoaded,
              },
            ]}
          />

          {/* ForeSys */}
          <MLBilan
            title="ForeSys"
            sprint="Sprint S5"
            algo="Prophet Time Series"
            color={C.foresys}
            loaded={fHealth?.forecast_loaded ?? false}
            onNavigate={() => onNavigate?.("foresys")}
            metrics={[
              {
                label: "Modèle chargé",
                value: fHealth?.forecast_loaded
                  ? "✅ Prophet PKL"
                  : "❌ Non chargé",
              },
              {
                label: "MAPE",
                value:
                  foreMetrics.mape != null
                    ? `${foreMetrics.mape.toFixed(2)}%`
                    : "—",
                ok:
                  foreMetrics.mape != null ? foreMetrics.mape < 15 : undefined,
              },
              {
                label: "R²",
                value: foreMetrics.r2 != null ? foreMetrics.r2.toFixed(4) : "—",
                ok: foreMetrics.r2 != null ? foreMetrics.r2 > 0.4 : undefined,
              },
              {
                label: "Prévision moy. / jour",
                value: fKPIs ? `${fKPIs.avg.toLocaleString()} u.` : "—",
              },
              {
                label: "Source données",
                value:
                  fDataSource?.using_kaggle_fallback === false
                    ? "SmartShop Live"
                    : "Kaggle Store Sales",
                ok: fDataSource?.using_kaggle_fallback === false,
              },
            ]}
          />
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: `1px solid ${C.border}`,
          paddingTop: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          color: C.muted,
        }}
      >
        <span>SmartShop Admin · PFE ML Intelligence</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <FiCalendar size={11} />
          {new Date().toLocaleDateString("fr-FR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      </div>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
