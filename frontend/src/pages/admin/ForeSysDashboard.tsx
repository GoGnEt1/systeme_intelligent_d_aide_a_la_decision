// src/pages/admin/ForeSysDashboard.tsx — CORRIGÉ v3
// ═══════════════════════════════════════════════════════════════════════════
// CORRECTIFS :
//   - Métriques lues depuis /forecast/metrics (valeurs numériques parsées)
//   - Hyperparamètres depuis /forecast/health ou /forecast/metrics
//   - Export rapport utilise metrics_parsed pour remplir nulls
//   - Training period depuis metadata correctement formatée
//   - v3 : Suppression suffixes k/M — affichage complet locale fr-FR
//          (ex : 88 159 unités, 1 234 567) — rendu professionnel
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useRef,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "../../store";
import * as d3 from "d3";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  FiTrendingUp,
  FiTrendingDown,
  FiActivity,
  FiCalendar,
  FiDownload,
  FiRefreshCw,
  FiZap,
  FiAlertCircle,
  FiCheckCircle,
  FiInfo,
  FiCpu,
  FiDatabase,
  FiTarget,
  FiArrowUp,
  FiArrowDown,
  FiLayers,
  FiClock,
} from "react-icons/fi";

import {
  fetchPredictions,
  fetchForecastHistory,
  fetchForecastComponents,
  fetchForecastMetrics,
  fetchForecastSummary,
  fetchForecastHealth,
  setSelectedHorizon,
  setActiveTab,
  triggerRetrain,
  clearRetrainStatus,
  selectPredictions,
  selectPredLoading,
  selectForecastHistory,
  selectHistoryLoading,
  selectComponents,
  selectWeeklyProfile,
  selectYearlyProfile,
  selectForecastMetrics,
  selectForecastSummary,
  selectForecastHealth,
  selectDataSource,
  selectSelectedHorizon,
  selectActiveTab,
  selectRetrainStatus,
  selectRetrainMessage,
  selectForecastKPIs,
} from "../../store/slices/forecastSlice";
import { useAdminTheme } from "./AdminDashboards";

// Hook to get theme-aware C palette inside components
function useC() {
  const T = useAdminTheme();
  return T.isDark ? C_DARK : C_LIGHT;
}

// ── Palette ───────────────────────────────────────────────────────────────────
// ── Theme-aware palette — reads from AdminThemeCtx ────────────────────────────
// Module-level static C kept ONLY for module-scope defaults (D3 uses ref-captured values)
const C_DARK = {
  primary: "#6366F1",
  secondary: "#8B5CF6",
  accent: "#06B6D4",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  muted: "#94A3B8",
  bg: "#0B1120",
  card: "#0F172A",
  border: "#1E293B",
  text: "#F1F5F9",
};

const C_LIGHT = {
  primary: "#6366F1",
  secondary: "#8B5CF6",
  accent: "#0891B2",
  success: "#059669",
  warning: "#D97706",
  danger: "#DC2626",
  muted: "#64748B",
  bg: "#F1F5F9",
  card: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
};

// Legacy alias — will be overridden inside components via useC()
const C = C_DARK;

// ── Utilitaires ───────────────────────────────────────────────────────────────
/**
 * Formate un nombre entier avec séparateurs de milliers (fr-FR).
 * Aucune abréviation (k / M) — rendu professionnel exigé.
 * Exemple : 1 234 567  |  88 159  |  70 425
 */
const fmt = (n: number): string => Math.round(n).toLocaleString("fr-FR");

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

const pctColor = (v: number, C: typeof C_DARK) =>
  v > 0 ? C.success : v < 0 ? C.danger : C.muted;

// ── KPI Card ─────────────────────────────────────────────────────────────────
const KPICard = memo(({ label, value, sub, icon, color, trend }: any) => {
  const C = useC();
  const cardColor = color ?? C.primary;
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${cardColor}, ${cardColor}44)`,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: C.muted,
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span style={{ color: cardColor, fontSize: 18 }}>{icon}</span>
      </div>
      <div
        style={{ fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1 }}
      >
        {value}
      </div>
      {(sub || trend !== undefined) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
          }}
        >
          {trend !== undefined && (
            <span
              style={{
                color: trend > 0 ? C.success : trend < 0 ? C.danger : C.muted,
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              {trend >= 0 ? <FiArrowUp size={11} /> : <FiArrowDown size={11} />}
              {Math.abs(trend).toFixed(1)} %
            </span>
          )}
          {sub && <span style={{ color: C.muted }}>{sub}</span>}
        </div>
      )}
    </div>
  );
});

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
const CT = memo(({ active, payload, label }: any) => {
  const C = useC();
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 13,
        color: C.text,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
      }}
    >
      <p style={{ fontWeight: 700, marginBottom: 6, color: C.accent }}>
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
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: p.color,
              display: "inline-block",
            }}
          />
          <span style={{ color: C.muted }}>{p.name}:</span>
          <span style={{ fontWeight: 600, color: C.text }}>
            {typeof p.value === "number" ? fmt(p.value) : (p.value ?? "—")}
          </span>
        </div>
      ))}
    </div>
  );
});

// ── D3 Composantes ────────────────────────────────────────────────────────────
const D3ComponentChart = memo(
  ({ weeklyProfile, yearlyProfile, theme }: any) => {
    const C = theme ?? C_DARK;
    const weekRef = useRef<SVGSVGElement>(null);
    const yearRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
      if (!weekRef.current || !weeklyProfile?.length) return;
      const svg = d3.select(weekRef.current);
      const W = 380,
        H = 180,
        M = { top: 20, right: 20, bottom: 30, left: 48 };
      svg.attr("viewBox", `0 0 ${W} ${H}`).style("overflow", "visible");
      svg.selectAll("*").remove();
      const x = d3
        .scaleBand()
        .domain(weeklyProfile.map((d: any) => d.day))
        .range([M.left, W - M.right])
        .padding(0.35);

      // const ext = d3.extent(weeklyProfile, (d: any) => d.effect) as [
      //   number,
      //   number,
      // ];
      const values = weeklyProfile
        .map((d: any) => d.effect)
        .filter((v: number) => v != null);
      const ext = d3.extent(values) as unknown as [number, number];

      const y = d3
        .scaleLinear()
        .domain(ext)
        .nice()
        .range([H - M.bottom, M.top]);
      svg
        .append("g")
        .selectAll("line")
        .data(y.ticks(4))
        .enter()
        .append("line")
        .attr("x1", M.left)
        .attr("x2", W - M.right)
        .attr("y1", (d: any) => y(d))
        .attr("y2", (d: any) => y(d))
        .attr("stroke", C.border)
        .attr("stroke-dasharray", "4,4");
      svg
        .append("line")
        .attr("x1", M.left)
        .attr("x2", W - M.right)
        .attr("y1", y(0))
        .attr("y2", y(0))
        .attr("stroke", C.muted)
        .attr("stroke-width", 1.5);
      const cs = d3
        .scaleSequential()
        .domain(ext)
        .interpolator(d3.interpolateRgb(C.danger, C.success));
      svg
        .selectAll("rect")
        .data(weeklyProfile)
        .enter()
        .append("rect")
        .attr("x", (d: any) => x(d.day)!)
        .attr("width", x.bandwidth())
        .attr("y", (d: any) => (d.effect >= 0 ? y(d.effect) : y(0)))
        .attr("height", (d: any) => Math.abs(y(d.effect) - y(0)))
        .attr("rx", 4)
        .attr("fill", (d: any) => cs(d.effect))
        .attr("opacity", 0.88);
      svg
        .append("g")
        .attr("transform", `translate(0,${H - M.bottom})`)
        .call(d3.axisBottom(x).tickSize(0))
        .selectAll("text")
        .style("fill", C.muted)
        .style("font-size", "11px");
      svg
        .append("g")
        .attr("transform", `translate(${M.left},0)`)
        .call(
          d3
            .axisLeft(y)
            .ticks(4)
            .tickFormat((d: any) => `${(+d * 100).toFixed(1)}%`),
        )
        .selectAll("text")
        .style("fill", C.muted)
        .style("font-size", "10px");
      svg.selectAll(".domain").remove();
    }, [weeklyProfile]);

    useEffect(() => {
      if (!yearRef.current || !yearlyProfile?.length) return;
      const svg = d3.select(yearRef.current);
      const W = 380,
        H = 180,
        M = { top: 20, right: 20, bottom: 30, left: 48 };
      svg.attr("viewBox", `0 0 ${W} ${H}`).style("overflow", "visible");
      svg.selectAll("*").remove();
      const x = d3
        .scaleBand()
        .domain(yearlyProfile.map((d: any) => d.month))
        .range([M.left, W - M.right])
        .padding(0.25);
      const values = weeklyProfile
        .map((d: any) => d.effect)
        .filter((v: number) => v != null);
      const ext = d3.extent(values) as unknown as [number, number];

      const y = d3
        .scaleLinear()
        .domain(ext)
        .nice()
        .range([H - M.bottom, M.top]);
      const area = d3
        .area<any>()
        .x((d) => x(d.month)! + x.bandwidth() / 2)
        .y0(y(0))
        .y1((d) => y(d.effect))
        .curve(d3.curveCatmullRom);
      const line = d3
        .line<any>()
        .x((d) => x(d.month)! + x.bandwidth() / 2)
        .y((d) => y(d.effect))
        .curve(d3.curveCatmullRom);
      const defs = svg.append("defs");
      const g = defs
        .append("linearGradient")
        .attr("id", "yg")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", 1);
      g.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", C.accent)
        .attr("stop-opacity", 0.5);
      g.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", C.accent)
        .attr("stop-opacity", 0.05);
      svg
        .append("path")
        .datum(yearlyProfile)
        .attr("d", area)
        .attr("fill", "url(#yg)");
      svg
        .append("path")
        .datum(yearlyProfile)
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", C.accent)
        .attr("stroke-width", 2.5);
      svg
        .append("g")
        .attr("transform", `translate(0,${H - M.bottom})`)
        .call(d3.axisBottom(x).tickSize(0))
        .selectAll("text")
        .style("fill", C.muted)
        .style("font-size", "10px");
      svg
        .append("g")
        .attr("transform", `translate(${M.left},0)`)
        .call(
          d3
            .axisLeft(y)
            .ticks(4)
            .tickFormat((d: any) => `${(+d * 100).toFixed(1)}%`),
        )
        .selectAll("text")
        .style("fill", C.muted)
        .style("font-size", "10px");
      svg.selectAll(".domain").remove();
    }, [yearlyProfile]);

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <p
            style={{
              color: C.muted,
              fontSize: 12,
              marginBottom: 12,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Effet hebdomadaire
          </p>
          <svg ref={weekRef} style={{ width: "100%", height: 180 }} />
        </div>
        <div>
          <p
            style={{
              color: C.muted,
              fontSize: 12,
              marginBottom: 12,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Effet annuel (saisonnalité)
          </p>
          <svg ref={yearRef} style={{ width: "100%", height: 180 }} />
        </div>
      </div>
    );
  },
);

// ── Badge source ──────────────────────────────────────────────────────────────
const DataBadge = memo(({ ds }: { ds: any }) => {
  const C = useC();
  if (!ds) return null;
  const kaggle = ds.using_kaggle_fallback;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: kaggle ? "#78350F22" : "#064E3B22",
        border: `1px solid ${kaggle ? C.warning : C.success}`,
        borderRadius: 8,
        padding: "5px 12px",
        fontSize: 12,
      }}
    >
      <FiDatabase size={12} color={kaggle ? C.warning : C.success} />
      <span style={{ color: kaggle ? C.warning : C.success, fontWeight: 600 }}>
        {kaggle ? "Données Kaggle (Store Sales)" : "✅ Données SmartShop Live"}
      </span>
      {kaggle && (
        <span style={{ color: C.muted }}>
          — {ds.smartshop_days}/{ds.threshold} j avant migration
        </span>
      )}
    </div>
  );
});

// ── Export ────────────────────────────────────────────────────────────────────
const ExportBtn = memo(
  ({ summary, metrics }: { summary: any; metrics: any }) => {
    const C = useC();
    const canExport = !!summary;

    const getMetricStr = useCallback(
      (key: "MAE" | "RMSE" | "MAPE" | "R2") => {
        // Priorité : metrics_parsed (valeurs numériques) → model_performance (strings)
        const mp = summary?.metrics_parsed;
        if (mp?.[key]?.value != null) {
          const v = mp[key].value;
          return key === "R2"
            ? v.toFixed(4)
            : key === "MAPE"
              ? `${v.toFixed(2)} %`
              : `${Math.round(v).toLocaleString("fr-FR")} DT`;
        }
        return summary?.model_performance?.[key] ?? "N/A";
      },
      [summary],
    );

    const handleTxt = useCallback(() => {
      if (!summary) return;
      const lines = [
        `╔══════════════════════════════════════════════════════╗`,
        `║         RAPPORT PRÉVISION DES VENTES — ForeSys       ║`,
        `║              SmartShop ML Intelligence               ║`,
        `╚══════════════════════════════════════════════════════╝`,
        ``,
        `Généré le : ${new Date(summary.generated_at).toLocaleString("fr-FR")}`,
        `Modèle    : ${summary.model_type} v${summary.model_version}`,
        `Source    : ${summary.data_source_detail}`,
        ``,
        `━━━ PÉRIODE D'ENTRAÎNEMENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Période   : ${summary.training_period}`,
        `Durée     : ${summary.n_training_days?.toLocaleString("fr-FR") ?? "N/A"} jours`,
        ``,
        `━━━ PÉRIODE DE PRÉVISION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Du ${summary.forecast_period.start} au ${summary.forecast_period.end}`,
        `Horizon   : ${summary.forecast_horizon} jours`,
        ``,
        `━━━ INDICATEURS CLÉS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Moyenne journalière : ${Math.round(summary.kpis.avg_daily_forecast).toLocaleString("fr-FR")} DT`,
        `Total 30 jours      : ${Math.round(summary.kpis.total_30d_forecast).toLocaleString("fr-FR")} DT`,
        `Pic de ventes       : ${summary.kpis.peak_day.date} (${Math.round(summary.kpis.peak_day.value).toLocaleString("fr-FR")} DT)`,
        `Creux de ventes     : ${summary.kpis.trough_day.date} (${Math.round(summary.kpis.trough_day.value).toLocaleString("fr-FR")} DT)`,
        `Tendance            : ${summary.kpis.trend_direction} (${summary.kpis.trend_pct_change >= 0 ? "+" : ""}${summary.kpis.trend_pct_change} %)`,
        ``,
        `━━━ PERFORMANCE DU MODÈLE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `MAE  : ${getMetricStr("MAE")}`,
        `RMSE : ${getMetricStr("RMSE")}`,
        `MAPE : ${getMetricStr("MAPE")}`,
        `R²   : ${getMetricStr("R2")}`,
        ``,
        `━━━ HYPERPARAMÈTRES PROPHET ━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ...(summary.hyperparameters
          ? Object.entries(summary.hyperparameters).map(
              ([k, v]) => `${k.padEnd(30)}: ${v}`,
            )
          : ["Hyperparamètres non disponibles"]),
        ``,
        `━━━ RECOMMANDATIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ...summary.recommendations.map(
          (r: string, i: number) => `${i + 1}. ${r}`,
        ),
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Rapport généré automatiquement par ForeSys.`,
      ];
      const blob = new Blob([lines.join("\n")], {
        type: "text/plain;charset=utf-8",
      });
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: `SmartShop_ForeSys_Rapport_${new Date().toISOString().slice(0, 10)}.txt`,
      });
      a.click();
      URL.revokeObjectURL(a.href);
    }, [summary, getMetricStr]);

    const handleJSON = useCallback(() => {
      if (!summary) return;
      // Enrichir le JSON avec les vraies valeurs de métriques
      const enriched = {
        ...summary,
        model_performance: {
          MAE: getMetricStr("MAE"),
          RMSE: getMetricStr("RMSE"),
          MAPE: getMetricStr("MAPE"),
          R2: getMetricStr("R2"),
        },
      };
      const blob = new Blob([JSON.stringify(enriched, null, 2)], {
        type: "application/json",
      });
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: `SmartShop_ForeSys_Data_${new Date().toISOString().slice(0, 10)}.json`,
      });
      a.click();
      URL.revokeObjectURL(a.href);
    }, [summary, getMetricStr]);

    return (
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleTxt}
          disabled={!canExport}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            background: canExport ? C.primary : C.border,
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "9px 16px",
            cursor: canExport ? "pointer" : "not-allowed",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <FiDownload size={14} /> Rapport .txt
        </button>
        <button
          onClick={handleJSON}
          disabled={!canExport}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            background: "transparent",
            color: canExport ? C.accent : C.muted,
            border: `1px solid ${canExport ? C.accent : C.border}`,
            borderRadius: 10,
            padding: "9px 16px",
            cursor: canExport ? "pointer" : "not-allowed",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <FiDownload size={14} /> Export JSON
        </button>
      </div>
    );
  },
);

// ── Onglet Métriques ─────────────────────────────────────────────────────────
const MetricsTab = memo(({ metrics }: { metrics: any }) => {
  const C = useC();
  if (!metrics)
    return (
      <div style={{ textAlign: "center", color: C.muted, padding: 60 }}>
        <FiCpu size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
        <p style={{ fontSize: 14 }}>Métriques non disponibles</p>
        <p style={{ fontSize: 12, marginTop: 6 }}>
          Vérifier que /forecast/metrics répond correctement
        </p>
      </div>
    );

  const cards = [
    { key: "MAE", m: metrics.MAE, color: C.accent },
    { key: "RMSE", m: metrics.RMSE, color: C.secondary },
    { key: "MAPE", m: metrics.MAPE, color: C.warning },
    { key: "R²", m: metrics.R2, color: C.success },
  ];

  const radarData = [
    {
      subject: "Précision",
      A:
        metrics.MAPE?.value != null
          ? Math.max(0, 100 - metrics.MAPE.value * 5)
          : 0,
    },
    {
      subject: "Robustesse",
      A: metrics.R2?.value != null ? Math.min(100, metrics.R2.value * 100) : 0,
    },
    { subject: "Stabilité", A: 75 },
    { subject: "Horizon", A: 85 },
    { subject: "Confiance", A: 90 },
    { subject: "Saisonnalité", A: 88 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ key, m, color }) => (
          <div
            key={key}
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: 20,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: C.muted,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
              }}
            >
              {m?.label ?? key}
            </div>
            <div
              style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1 }}
            >
              {m?.value != null
                ? key === "MAPE"
                  ? m.value.toFixed(2)
                  : key === "R²"
                    ? m.value.toFixed(4)
                    : Math.round(m.value).toLocaleString("fr-FR")
                : "N/A"}
              <span style={{ fontSize: 13, color: C.muted, marginLeft: 3 }}>
                {m?.unit}
              </span>
            </div>
            <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color }}>
              {key}
            </div>
            {m?.quality && (
              <div
                style={{
                  marginTop: 8,
                  display: "inline-block",
                  padding: "2px 10px",
                  background: `${color}22`,
                  borderRadius: 20,
                  fontSize: 11,
                  color,
                  fontWeight: 600,
                }}
              >
                {m.quality}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 20,
          }}
        >
          <p style={{ color: C.text, fontWeight: 700, marginBottom: 16 }}>
            Profil de Performance
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={C.border} />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: C.muted, fontSize: 12 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fill: C.muted, fontSize: 9 }}
              />
              <Radar
                name="Modèle"
                dataKey="A"
                stroke={C.primary}
                fill={C.primary}
                fillOpacity={0.3}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 20,
          }}
        >
          <p style={{ color: C.text, fontWeight: 700, marginBottom: 16 }}>
            <FiCpu size={14} style={{ marginRight: 8 }} />
            Hyperparamètres Prophet
          </p>
          {metrics.hyperparameters ? (
            Object.entries(metrics.hyperparameters).map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "#ffffff08",
                  borderRadius: 8,
                  marginBottom: 6,
                }}
              >
                <span style={{ color: C.muted, fontSize: 12 }}>
                  {k.replace(/_/g, " ")}
                </span>
                <span
                  style={{ color: C.accent, fontWeight: 700, fontSize: 13 }}
                >
                  {String(v)}
                </span>
              </div>
            ))
          ) : (
            <p style={{ color: C.muted, fontSize: 13 }}>
              Hyperparamètres non disponibles
            </p>
          )}
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              background: "#6366F108",
              border: `1px solid ${C.primary}33`,
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 11, color: C.muted }}>Entraîné le</div>
            <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
              {metrics.trained_at
                ? new Date(metrics.trained_at).toLocaleString("fr-FR")
                : "—"}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
              Période :{" "}
              {metrics.training_start && metrics.training_end
                ? `${metrics.training_start} → ${metrics.training_end}`
                : "—"}{" "}
              · {metrics.n_training_days?.toLocaleString("fr-FR") ?? "—"} jours
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// ───── Main  ────────────────────────────────────────────────────────────────────────
type ForeTab = "forecast" | "history" | "components" | "metrics";

const ForeSysDashboard: React.FC = () => {
  const T = useAdminTheme();
  const C = T.isDark ? C_DARK : C_LIGHT; // ← live theme C for inline styles & chart props
  const dispatch = useDispatch<AppDispatch>();
  const predictions = useSelector(selectPredictions);
  const predLoading = useSelector(selectPredLoading);
  const history = useSelector(selectForecastHistory);
  const histLoading = useSelector(selectHistoryLoading);
  const weeklyProfile = useSelector(selectWeeklyProfile);
  const yearlyProfile = useSelector(selectYearlyProfile);
  const metrics = useSelector(selectForecastMetrics);
  const summary = useSelector(selectForecastSummary);
  const health = useSelector(selectForecastHealth);
  const dataSource = useSelector(selectDataSource);
  const horizon = useSelector(selectSelectedHorizon);
  const activeTab = useSelector(selectActiveTab);
  const retrainStatus = useSelector(selectRetrainStatus);
  const retrainMsg = useSelector(selectRetrainMessage);
  const kpis = useSelector(selectForecastKPIs);

  useEffect(() => {
    dispatch(fetchForecastHealth());
    dispatch(fetchPredictions(30));
    dispatch(fetchForecastHistory(24));
    dispatch(fetchForecastComponents(90));
    dispatch(fetchForecastMetrics());
    dispatch(fetchForecastSummary());
  }, [dispatch]);

  const handleRefresh = useCallback(() => {
    dispatch(fetchForecastHealth());
    dispatch(fetchPredictions(horizon));
    dispatch(fetchForecastHistory(24));
    dispatch(fetchForecastComponents(90));
    dispatch(fetchForecastMetrics());
    dispatch(fetchForecastSummary());
  }, [dispatch, horizon]);

  const handleHorizon = useCallback(
    (h: number) => {
      dispatch(setSelectedHorizon(h));
      dispatch(fetchPredictions(h));
    },
    [dispatch],
  );

  const forecastData = useMemo(
    () =>
      predictions.map((p) => ({
        date: fmtDate(p.date),
        Prévision: Math.round(p.prediction),
        "Borne basse": Math.round(p.pred_lower),
        "Borne haute": Math.round(p.pred_upper),
        Tendance: Math.round(p.trend),
      })),
    [predictions],
  );

  const historyData = useMemo(
    () =>
      history.map((h) => ({
        month: h.month,
        Moyenne: Math.round(h.avg_sales),
      })),
    [history],
  );

  const TABS: { id: ForeTab; label: string }[] = [
    { id: "forecast", label: "📈 Prévisions 30j" },
    { id: "history", label: "📊 Historique" },
    { id: "components", label: "🧩 Composantes" },
    { id: "metrics", label: "⚙️ Performances" },
  ];
  return (
    // <div
    //   style={{
    //     background: C.bg,
    //     minHeight: "100vh",
    //     padding: "28px 32px",
    //     fontFamily: "'Inter',-apple-system,sans-serif",
    //     color: C.text,
    //   }}
    // >
    <div
      className="ml-dashboard-root bg-gognet-dark min-h-screen p-4 sm:p-6 lg:p-8 font-sans space-y-5"
      style={{ background: T.isDark ? undefined : T.bg, color: T.text }}
    >
      {/* ── Theme overrides for light mode ── */}
      {!T.isDark && (
        <style>{`
          .ml-dashboard-root .bg-gognet-dark { background: ${T.bg} !important; }
          .ml-dashboard-root .bg-gognet-navy { background: ${T.card} !important; }
          .ml-dashboard-root .bg-gognet-navy\\/50 { background: ${T.card}88 !important; }
          .ml-dashboard-root .bg-white\\/5 { background: ${T.active} !important; }
          .ml-dashboard-root .bg-white\\/10 { background: ${T.active} !important; }
          .ml-dashboard-root .bg-white\\/3 { background: ${T.active} !important; }
          .ml-dashboard-root .border-gognet-border-dark { border-color: ${T.border} !important; }
          .ml-dashboard-root .border-white\\/10 { border-color: ${T.border} !important; }
          .ml-dashboard-root .border-white\\/5 { border-color: ${T.border} !important; }
          .ml-dashboard-root .text-white { color: ${T.text} !important; }
          .ml-dashboard-root .text-slate-100 { color: ${T.text} !important; }
          .ml-dashboard-root .text-slate-200 { color: ${T.text} !important; }
          .ml-dashboard-root .text-slate-300 { color: ${T.muted} !important; }
          .ml-dashboard-root .text-slate-400 { color: ${T.muted} !important; }
          .ml-dashboard-root .text-slate-500 { color: ${T.muted} !important; }
          .ml-dashboard-root .text-slate-600 { color: ${T.muted} !important; }
          .ml-dashboard-root .text-gray-300 { color: ${T.muted} !important; }
          .ml-dashboard-root .text-gray-400 { color: ${T.muted} !important; }
          .ml-dashboard-root .text-gray-500 { color: ${T.muted} !important; }
          .ml-dashboard-root input, .ml-dashboard-root select, .ml-dashboard-root textarea {
            background: ${T.inputBg} !important;
            color: ${T.text} !important;
            border-color: ${T.border} !important;
          }
          .ml-dashboard-root .rounded-2xl { box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        `}</style>
      )}
      <div className="bg-gognet-navy border border-gognet-border-dark rounded-2xl p-5">
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-gognet-indigo to-violet-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <FiZap className="text-white text-lg" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-black text-[20px] text-white tracking-tight">
                  ForeSys <span className="text-gognet-indigo-light">ML</span>
                </h2>

                <span className="text-[10px] bg-indigo-500/20 text-gognet-indigo-light border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">
                  Prophet (times series)
                </span>
              </div>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Prévision des Ventes en temps réel
              </p>{" "}
              {/* <DataBadge ds={dataSource} /> */}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {health && (
              <div
                className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border`}
              >
                {health.forecast_loaded ? (
                  <FiCheckCircle size={11} />
                ) : (
                  <FiAlertCircle size={11} />
                )}
                <span>
                  {" "}
                  ForeSys {health.forecast_loaded ? "Actif" : "Inactif"}{" "}
                </span>

                {health.version && (
                  <span style={{ color: C.muted }}>v{health.version}</span>
                )}
              </div>
            )}

            {/* <div className="flex items-center gap-2 flex-wrap"> */}
            <ExportBtn summary={summary} metrics={metrics} />

            <button
              onClick={handleRefresh}
              title="Rafraîchir"
              disabled={predLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 text-[12px] font-bold rounded-xl border border-gognet-border-dark transition-all"
            >
              <FiRefreshCw
                size={13}
                className={predLoading ? "animate-spin" : ""}
              />
            </button>

            <button
              onClick={() => dispatch(triggerRetrain())}
              disabled={retrainStatus === "running"}
              className={`flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 text-[12px] font-bold rounded-xl border border-gognet-border-dark transition-all disabled:opacity-60 ${retrainStatus === "running" ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <FiCpu size={13} />
              {retrainStatus === "running" ? "Entraînement…" : "Ré-entraîner"}
            </button>
            {/* </div> */}
          </div>
        </div>

        {retrainMsg && (
          <div
            className={`flex justify-between mt-3 text-[12px] px-3 py-2 rounded-xl font-medium border ${retrainMsg.startsWith("✅") ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}
          >
            <span>{retrainMsg}</span>
            <button
              onClick={() => dispatch(clearRetrainStatus())}
              style={{
                background: "none",
                border: "none",
                color: "inherit",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      {/* <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 16,
          marginBottom: 28,
        }}
      > */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Moyenne journalière"
          value={kpis ? fmt(kpis.avg) : "—"}
          sub="unités prévues/j"
          icon={<FiActivity />}
          color={C.primary}
        />
        <KPICard
          label="Total 30 jours"
          value={kpis ? fmt(kpis.total) : "—"}
          sub="cumul prévisionnel"
          icon={<FiCalendar />}
          color={C.accent}
        />
        <KPICard
          label="Pic de ventes"
          value={kpis ? fmt(kpis.peak.value) : "—"}
          sub={kpis?.peak.date ? fmtDate(kpis.peak.date) : ""}
          icon={<FiArrowUp />}
          color={C.success}
        />
        <KPICard
          label="Tendance"
          value={
            kpis
              ? `${kpis.trendPct >= 0 ? "+" : ""}${kpis.trendPct.toFixed(1)} %`
              : "—"
          }
          sub={kpis ? (kpis.trendUp ? "haussière" : "baissière") : ""}
          icon={kpis?.trendUp ? <FiTrendingUp /> : <FiTrendingDown />}
          color={kpis ? pctColor(kpis.trendPct, C) : C.muted}
          trend={kpis?.trendPct}
        />
      </div>

      {/* Tabs */}

      <div className="flex gap-1 mt-5 border-b border-gognet-border-dark overflow-x-auto scrollbar-hide pb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => dispatch(setActiveTab(t.id as any))}
            className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-all whitespace-nowrap flex-shrink-0 ${
              activeTab === t.id
                ? "border-gognet-indigo text-gognet-indigo-light"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Prévisions */}
      {activeTab === "forecast" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {[7, 14, 30].map((h) => (
              <button
                key={h}
                onClick={() => handleHorizon(h)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: horizon === h ? C.primary : "transparent",
                  color: horizon === h ? "white" : C.muted,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {h} jours
              </button>
            ))}
          </div>
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              padding: "24px 24px 16px",
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
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  Prévisions des Ventes — {horizon} jours
                </h3>
                <p style={{ color: C.muted, fontSize: 12, margin: "4px 0 0" }}>
                  Intervalles de confiance à 95%
                </p>
              </div>
              {predLoading && (
                <span style={{ color: C.muted, fontSize: 12 }}>
                  Chargement…
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={forecastData}>
                <defs>
                  <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.primary} stopOpacity={0.3} />
                    <stop
                      offset="95%"
                      stopColor={C.primary}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={C.border}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: C.muted, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.floor(forecastData.length / 6)}
                />
                <YAxis
                  tick={{ fill: C.muted, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    Math.round(v).toLocaleString("fr-FR")
                  }
                />
                <Tooltip content={<CT />} />
                <Legend
                  wrapperStyle={{
                    color: C.muted,
                    fontSize: 12,
                    paddingTop: 12,
                  }}
                />
                <Area
                  dataKey="Borne haute"
                  fill={`${C.primary}18`}
                  stroke="none"
                  legendType="none"
                />
                <Area
                  dataKey="Borne basse"
                  fill={C.bg}
                  stroke="none"
                  legendType="none"
                />
                <Area
                  dataKey="Prévision"
                  stroke={C.primary}
                  fill="url(#pg)"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  dataKey="Tendance"
                  stroke={C.warning}
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              padding: 24,
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>
              Détail journalier
            </h3>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Date", "Prévision", "Borne −", "Borne +", "Tendance"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 12px",
                          textAlign: h === "Date" ? "left" : "right",
                          color: C.muted,
                          fontWeight: 600,
                          fontSize: 11,
                          textTransform: "uppercase",
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {predictions.map((p, i) => (
                  <tr
                    key={p.date}
                    style={{
                      borderBottom: `1px solid ${C.border}22`,
                      background: i % 2 === 0 ? "transparent" : "#ffffff04",
                    }}
                  >
                    <td
                      style={{
                        padding: "7px 12px",
                        color: C.accent,
                        fontWeight: 600,
                      }}
                    >
                      {fmtDate(p.date)}
                    </td>
                    <td
                      style={{
                        padding: "7px 12px",
                        textAlign: "right",
                        fontWeight: 700,
                      }}
                    >
                      {Math.round(p.prediction).toLocaleString("fr-FR")}
                    </td>
                    <td
                      style={{
                        padding: "7px 12px",
                        textAlign: "right",
                        color: C.danger,
                      }}
                    >
                      {Math.round(p.pred_lower).toLocaleString("fr-FR")}
                    </td>
                    <td
                      style={{
                        padding: "7px 12px",
                        textAlign: "right",
                        color: C.success,
                      }}
                    >
                      {Math.round(p.pred_upper).toLocaleString("fr-FR")}
                    </td>
                    <td
                      style={{
                        padding: "7px 12px",
                        textAlign: "right",
                        color: C.muted,
                      }}
                    >
                      {Math.round(p.trend).toLocaleString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historique */}
      {activeTab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              padding: "24px 24px 16px",
            }}
          >
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>
              Historique Mensuel des Ventes
            </h3>
            <p style={{ color: C.muted, fontSize: 12, margin: "0 0 16px" }}>
              Données Kaggle Store Sales 2013–2017 ({history.length} mois)
            </p>
            {histLoading ? (
              <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>
                Chargement…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={historyData} barSize={18}>
                  <defs>
                    <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={C.accent}
                        stopOpacity={0.9}
                      />
                      <stop
                        offset="100%"
                        stopColor={C.primary}
                        stopOpacity={0.5}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={C.border}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: C.muted, fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.floor(historyData.length / 8)}
                  />
                  <YAxis
                    tick={{ fill: C.muted, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) =>
                      Math.round(v).toLocaleString("fr-FR")
                    }
                  />
                  <Tooltip content={<CT />} />
                  <Bar
                    dataKey="Moyenne"
                    fill="url(#hg)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* <div
            style={{
              background: "#78350F11",
              border: `1px solid ${C.warning}44`,
              borderRadius: 14,
              padding: "16px 20px",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <FiInfo
              color={C.warning}
              size={18}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <div>
              <p
                style={{
                  color: C.warning,
                  fontWeight: 700,
                  margin: "0 0 4px",
                  fontSize: 13,
                }}
              >
                Migration automatique
              </p>
              <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>
                Dashboard en mode Kaggle. Migration auto dès{" "}
                <strong style={{ color: C.text }}>
                  {dataSource?.threshold ?? 365} jours
                </strong>{" "}
                de ventes SmartShop. Progression :{" "}
                {dataSource?.smartshop_days ?? 0} /{" "}
                {dataSource?.threshold ?? 365} jours.
              </p>
            </div>
          </div> */}
        </div>
      )}

      {/* Composantes */}
      {activeTab === "components" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              padding: "24px 24px 16px",
            }}
          >
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>
              Décomposition Prophet
            </h3>
            <p style={{ color: C.muted, fontSize: 12, margin: "0 0 20px" }}>
              Tendance + Saisonnalités hebdomadaire et annuelle
            </p>
            <D3ComponentChart
              weeklyProfile={weeklyProfile}
              yearlyProfile={yearlyProfile}
              theme={T.isDark ? C_DARK : C_LIGHT}
            />
          </div>
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              padding: "24px 24px 16px",
            }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>
              Évolution de la Tendance
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={predictions.map((p) => ({
                  date: fmtDate(p.date),
                  Tendance: Math.round(p.trend),
                }))}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={C.border}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: C.muted, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: C.muted, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    Math.round(v).toLocaleString("fr-FR")
                  }
                />
                <Tooltip content={<CT />} />
                <Line
                  dataKey="Tendance"
                  stroke={C.warning}
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Métriques */}
      {activeTab === "metrics" && <MetricsTab metrics={metrics} />}

      <div
        style={{
          marginTop: 32,
          padding: "16px 0 0",
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          color: C.muted,
        }}
      >
        <span>ForeSys · Sprint S5 · Prophet · SmartShop ML Intelligence</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <FiClock size={11} /> {new Date().toLocaleString("fr-FR")}
        </span>
      </div>
    </div>
  );
};

export default ForeSysDashboard;
