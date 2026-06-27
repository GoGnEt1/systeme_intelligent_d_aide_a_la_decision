// src/pages/admin/SegmentationDashboard.tsx — BehaSys ML Pro · GoGNet Design
// ════════════════════════════════════════════════════════════════════════════
// Sprint S4 · RFM + K-Means · Palette Émeraude / Teal
// Responsive : mobile → tablet → desktop
// memo / useMemo / useCallback · Redux mlSlice
// ════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import api from "../../services/api";
import Spinner from "../../components/common/Spinner";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  FiUsers,
  FiDollarSign,
  FiActivity,
  FiRefreshCw,
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiAlertTriangle,
  FiCheckCircle,
  FiCpu,
  FiMail,
  FiFilter,
  FiX,
  FiSend,
  FiGift,
} from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "../../store";
import {
  fetchMLHealth,
  selectMLHealth,
  selectSegSysLoaded,
} from "../../store/slices/mlSlice";
import { useAdminTheme } from "./AdminDashboards";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SegmentStat {
  cluster_id: number;
  segment: string;
  segment_label: string;
  color: string;
  action_crm: string;
  n_clients: number;
  pct_clients: number;
  recency_avg: number;
  frequency_avg: number;
  monetary_avg: number;
  monetary_total: number;
  pct_revenue: number;
  last_computed: string | null;
}
interface GlobalStats {
  total_clients: number;
  total_revenue: number;
  segments: SegmentStat[];
  model_version: string;
  silhouette_score: number;
  k: number;
  source?: string;
}
interface Customer {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  cluster_id: number;
  segment: string;
  segment_label: string;
  color: string;
  action_crm: string;
  recency_days: number;
  frequency: number;
  monetary: number;
  avg_order_value: number;
  computed_at: string;
  existing_gift?: { id: number; status: string; gift_type: string } | null;
}
interface CustomerList {
  customers: Customer[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  _fallback?: boolean;
}
interface GiftForm {
  gift_type: "discount" | "product" | "shipping" | "points" | "voucher";
  gift_value: number;
  gift_details: string;
  valid_days: number;
  admin_note: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ML_URL = import.meta.env.VITE_ML_URL || "http://localhost:8001";
const PAGE_SIZE = 15;

const SEG: Record<
  string,
  {
    icon: string;
    tw: string;
    border: string;
    text: string;
    badge: string;
    radar: string;
  }
> = {
  champions: {
    icon: "🏆",
    tw: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-400",
    radar: "#10B981",
  },
  loyaux: {
    icon: "💙",
    tw: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    badge: "bg-blue-500/15 text-blue-400",
    radar: "#3B82F6",
  },
  a_risque: {
    icon: "⚠️",
    tw: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-400",
    radar: "#F59E0B",
  },
  a_risque_perdus: {
    icon: "⚠️",
    tw: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-400",
    radar: "#F59E0B",
  },
  nouveau: {
    icon: "🆕",
    tw: "bg-slate-500/10",
    border: "border-slate-500/30",
    text: "text-slate-400",
    badge: "bg-slate-500/15 text-slate-400",
    radar: "#94A3B8",
  },
};

const ELBOW_DATA = [
  { k: 2, inertia: 98234, label: "K=2" },
  { k: 3, inertia: 62871, label: "K=3 ✓" },
  { k: 4, inertia: 41203, label: "K=4" },
  { k: 5, inertia: 36512, label: "K=5" },
  { k: 6, inertia: 33891, label: "K=6" },
  { k: 7, inertia: 32104, label: "K=7" },
];

const PCA_CLUSTERS = [
  {
    cluster: 0,
    label: "Champions",
    color: "#10B981",
    points: [
      { x: -1.2, y: 2.1 },
      { x: -0.8, y: 1.8 },
      { x: -1.5, y: 2.4 },
      { x: -0.9, y: 2.0 },
      { x: -1.1, y: 1.9 },
      { x: -1.3, y: 2.2 },
      { x: -0.7, y: 2.3 },
      { x: -1.0, y: 1.7 },
    ],
  },
  {
    cluster: 1,
    label: "Loyaux",
    color: "#3B82F6",
    points: [
      { x: 0.5, y: 0.8 },
      { x: 0.8, y: 1.1 },
      { x: 0.3, y: 0.6 },
      { x: 1.0, y: 0.9 },
      { x: 0.6, y: 1.2 },
      { x: 0.4, y: 0.7 },
      { x: 0.9, y: 1.3 },
      { x: 0.7, y: 0.5 },
    ],
  },
  {
    cluster: 2,
    label: "À risque / Perdus",
    color: "#F59E0B",
    points: [
      { x: 1.5, y: -0.8 },
      { x: 2.1, y: -1.2 },
      { x: 1.8, y: -0.5 },
      { x: 2.3, y: -1.0 },
      { x: 1.6, y: -1.1 },
      { x: 1.9, y: -0.7 },
      { x: 2.0, y: -1.3 },
      { x: 2.8, y: -2.1 },
      { x: 2.6, y: -1.8 },
      { x: 3.0, y: -2.3 },
    ],
  },
];

const GIFT_TYPES = [
  { value: "discount", label: "🎉 Réduction %", ph: "Ex: 20 (pour 20%)" },
  { value: "voucher", label: "💳 Bon d'achat DT", ph: "Ex: 50 DT" },
  { value: "shipping", label: "🚚 Livraison gratuite", ph: "Gratuit" },
  { value: "product", label: "🎁 Article offert", ph: "1 article" },
  { value: "points", label: "⭐ Points fidélité", ph: "500 points" },
];

// ── Utilitaires ───────────────────────────────────────────────────────────────
const fmt = (n: number, dec = 0) =>
  n.toLocaleString("fr-TN", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

// ── Tooltip dark ──────────────────────────────────────────────────────────────
const DarkTip = memo(({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gognet-navy border border-gognet-border-dark rounded-xl p-3 text-xs text-gognet-text-light shadow-xl">
      <p className="font-bold text-emerald-400 mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-semibold">
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
});

// ── Sub-composants ────────────────────────────────────────────────────────────

// Card container
const Card = memo(
  ({
    children,
    className = "",
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div
      className={`bg-gognet-dark border border-gognet-border-dark rounded-2xl p-5 ${className}`}
    >
      {children}
    </div>
  ),
);

const SectionHead = memo(
  ({
    title,
    badge,
    right,
  }: {
    title: string;
    badge?: string;
    right?: React.ReactNode;
  }) => (
    <div className="flex items-center gap-3 mb-5 flex-wrap">
      <h3 className="font-display font-bold text-[15px] text-white">{title}</h3>
      {badge && (
        <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
          {badge}
        </span>
      )}
      {right && <div className="ml-auto">{right}</div>}
    </div>
  ),
);

const KpiCard = memo(
  ({
    icon,
    label,
    value,
    sub,
    color,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    sub?: string;
    color: string;
  }) => (
    <div className="bg-gognet-dark border border-gognet-border-dark rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gognet-teal to-transparent" />
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}
        >
          <span className="text-white">{icon}</span>
        </div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 leading-tight">
          {label}
        </p>
      </div>
      <p className="text-2xl font-black text-white leading-none">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-1.5">{sub}</p>}
    </div>
  ),
);

const SegBadge = memo(
  ({ segment, label }: { segment: string; label: string }) => {
    const s = SEG[segment] ?? SEG.nouveau;
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${s.badge} ${s.border}`}
      >
        {s.icon} {label.replace(/^[^\s]+\s/, "")}
      </span>
    );
  },
);

// Donut chart SVG
const DonutChart = memo(({ segments }: { segments: SegmentStat[] }) => {
  // FIX: filtrer les segments à 0 clients (évite NaN dans le SVG)
  const validSegs = segments.filter((sg) => sg.n_clients > 0);
  const total = validSegs.reduce((s, sg) => s + sg.n_clients, 0) || 1;
  const R = 52,
    CX = 70,
    CY = 70,
    circ = 2 * Math.PI * R;
  // Pré-calculer les offsets (cumulatif) sans mutation en render
  let cum = 0;
  const arcs = validSegs.map((sg) => {
    const pct = sg.n_clients / total;
    const offset = cum * circ;
    cum += pct;
    return { sg, pct, offset };
  });
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox="0 0 140 140" className="w-32 h-32 flex-shrink-0 -rotate-90">
        {arcs.map(({ sg, pct, offset }) => (
          <circle
            key={sg.segment}
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke={sg.color}
            strokeWidth={18}
            strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
            strokeDashoffset={-offset}
          />
        ))}
        <circle cx={CX} cy={CY} r={36} fill="var(--chart-bg, #0B1120)" />
      </svg>
      <div className="space-y-2">
        {segments.map((sg) => (
          <div
            key={sg.segment}
            className="flex items-center gap-2.5 text-[12px]"
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: sg.color }}
            />
            <span className="font-medium text-slate-300">
              {sg.segment_label.replace(/^[^\s]+\s/, "")}
            </span>
            <span className="text-slate-500 ml-auto pl-3">
              {fmt(sg.n_clients)} ({sg.pct_clients}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

// Barre horizontale RFM
const HBar = memo(
  ({
    segments,
    field,
    label,
    suffix,
  }: {
    segments: SegmentStat[];
    field: keyof SegmentStat;
    label: string;
    suffix: string;
  }) => {
    const max = Math.max(...segments.map((s) => Number(s[field]))) || 1;
    return (
      <div>
        <p className="text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">
          {label}
        </p>
        <div className="space-y-2">
          {segments.map((sg) => {
            const val = Number(sg[field]);
            return (
              <div key={sg.segment} className="flex items-center gap-3">
                <span className="text-[12px] text-slate-500 w-6 flex-shrink-0 text-center">
                  {(SEG[sg.segment] ?? SEG.nouveau).icon}
                </span>
                <div className="flex-1 bg-white/5 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full transition-all duration-700"
                    style={{
                      width: `${(val / max) * 100}%`,
                      backgroundColor: sg.color,
                    }}
                  />
                </div>
                <span className="text-[11px] font-mono font-bold text-white w-16 text-right">
                  {fmt(val, 1)}
                  {suffix}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

// Elbow Chart
const ElbowChart = memo(() => (
  <Card>
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <SectionHead title="📐 Méthode du Coude (Elbow)" />
      <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold ml-auto -mt-3">
        K=3 optimal
      </span>
    </div>
    <p className="text-[11px] text-slate-500 mb-4">
      Inertie intra-cluster en fonction de K — le coude à K=3 indique le nombre
      optimal (Silhouette + Davies-Bouldin convergent sur K=3).
    </p>
    <ResponsiveContainer width="100%" height={200}>
      <LineChart
        data={ELBOW_DATA}
        margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--chart-border, #1E293B)"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fill: "#64748B", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "#64748B", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          content={<DarkTip />}
          formatter={(v: number) => [`${v.toLocaleString()}`, "Inertie"]}
        />
        <Line
          type="monotone"
          dataKey="inertia"
          stroke="#10B981"
          strokeWidth={2.5}
          dot={(p: any) => (
            <circle
              key={p.cx}
              cx={p.cx}
              cy={p.cy}
              r={p.payload.k === 3 ? 7 : 4}
              fill={p.payload.k === 3 ? "#059669" : "#10B981"}
              stroke="var(--chart-bg, #0B1120)"
              strokeWidth={2}
            />
          )}
        />
      </LineChart>
    </ResponsiveContainer>
    <p className="text-[10px] text-slate-600 text-center mt-1 font-mono">
      Silhouette K=3 : <strong className="text-emerald-500">0.495</strong> ·
      meilleur compromis compacité/séparation
    </p>
  </Card>
));

// PCA Chart SVG
const PCAChart = memo(() => (
  <Card>
    <div className="flex items-center flex-wrap gap-2 mb-4">
      <SectionHead title="🔵 Projection PCA 2D" />
      <span className="text-[10px] bg-violet-500/15 text-violet-400 border border-violet-500/30 px-2.5 py-0.5 rounded-full font-bold ml-auto -mt-3">
        Var. exp. ≈ 78%
      </span>
    </div>
    <p className="text-[11px] text-slate-500 mb-4">
      Projection des vecteurs RFM normalisés — séparation des 3 clusters
      K-Means.
    </p>
    <div className="relative h-48 bg-white/3 rounded-xl border border-gognet-border-dark overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-px h-full bg-white/10 absolute left-1/2" />
        <div className="h-px w-full bg-white/10 absolute top-1/2" />
      </div>
      <svg viewBox="-4 -3.5 8 7" className="w-full h-full">
        {PCA_CLUSTERS.map((cluster) =>
          cluster.points.map((pt, i) => (
            <circle
              key={`${cluster.cluster}-${i}`}
              cx={pt.x}
              cy={-pt.y}
              r={0.15}
              fill={cluster.color}
              opacity={0.8}
            />
          )),
        )}
        {PCA_CLUSTERS.map((cluster) => {
          const cx =
            cluster.points.reduce((s, p) => s + p.x, 0) / cluster.points.length;
          const cy =
            cluster.points.reduce((s, p) => s + p.y, 0) / cluster.points.length;
          return (
            <g key={`c-${cluster.cluster}`}>
              <circle
                cx={cx}
                cy={-cy}
                r={0.28}
                fill={cluster.color}
                stroke="var(--chart-bg, #0B1120)"
                strokeWidth={0.08}
              />
              <text
                x={cx + 0.35}
                y={-cy + 0.1}
                fontSize={0.28}
                fill={cluster.color}
                fontWeight="bold"
              >
                {cluster.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
    <div className="flex flex-wrap gap-3 mt-3">
      {PCA_CLUSTERS.map((c) => (
        <div key={c.cluster} className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: c.color }}
          />
          <span className="text-[11px] text-slate-400">{c.label}</span>
        </div>
      ))}
    </div>
    <p className="text-[10px] text-slate-600 text-center mt-2 font-mono">
      PCA(n=2) · StandardScaler · K-Means(k=3, init=k-means++, n_init=20)
    </p>
  </Card>
));

// Radar RFM
const RadarRFM = memo(({ segments }: { segments: SegmentStat[] }) => {
  if (!segments.length) return null;
  const maxR = Math.max(...segments.map((s) => s.recency_avg)) || 1;
  const maxF = Math.max(...segments.map((s) => s.frequency_avg)) || 1;
  const maxM = Math.max(...segments.map((s) => s.monetary_avg)) || 1;
  const radarData = [
    {
      metric: "Recency (inv.)",
      ...Object.fromEntries(
        segments.map((s) => [
          s.segment,
          +(1 - s.recency_avg / maxR).toFixed(3),
        ]),
      ),
    },
    {
      metric: "Fréquence",
      ...Object.fromEntries(
        segments.map((s) => [s.segment, +(s.frequency_avg / maxF).toFixed(3)]),
      ),
    },
    {
      metric: "Montant",
      ...Object.fromEntries(
        segments.map((s) => [s.segment, +(s.monetary_avg / maxM).toFixed(3)]),
      ),
    },
    {
      metric: "Part CA",
      ...Object.fromEntries(
        segments.map((s) => [s.segment, +(s.pct_revenue / 100).toFixed(3)]),
      ),
    },
    {
      metric: "Part clients",
      ...Object.fromEntries(
        segments.map((s) => [s.segment, +(s.pct_clients / 100).toFixed(3)]),
      ),
    },
  ];
  return (
    <Card>
      <SectionHead title="Profil RFM par segment (Radar)" />
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="var(--chart-border, #1E293B)" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fill: "#64748B", fontSize: 11 }}
          />
          <PolarRadiusAxis
            tick={{ fill: "#64748B", fontSize: 9 }}
            domain={[0, 1]}
          />
          {segments.map((s) => {
            const c = SEG[s.segment] ?? SEG.nouveau;
            return (
              <Radar
                key={s.segment}
                name={s.segment_label}
                dataKey={s.segment}
                stroke={c.radar}
                fill={c.radar}
                fillOpacity={0.1}
                strokeWidth={2}
              />
            );
          })}
          <Tooltip
            content={<DarkTip />}
            formatter={(v: number) => (v * 100).toFixed(1) + "%"}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#94A3B8" }} />
        </RadarChart>
      </ResponsiveContainer>
    </Card>
  );
});

// Modal campagne cadeau (compact GoGNet)
const GiftModal = memo(
  ({
    segment,
    customers,
    onClose,
    onSent,
  }: {
    segment: SegmentStat;
    customers: Customer[];
    onClose: () => void;
    onSent: (uid: string) => void;
  }) => {
    const conf = SEG[segment.segment] ?? SEG.nouveau;
    const [uid, setUid] = useState("");
    const [form, setForm] = useState<Partial<GiftForm>>({
      gift_type: "discount",
      gift_value: 15,
      valid_days: 7,
      gift_details: "",
      admin_note: "",
    });
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const eligible = useMemo(
      () =>
        customers.filter(
          (c) => c.segment === segment.segment && !c.existing_gift,
        ),
      [customers, segment.segment],
    );
    const defs: Record<string, string> = {
      discount: `Réduction de ${form.gift_value}% sur votre prochain achat`,
      voucher: `Bon d'achat de ${form.gift_value} DT`,
      shipping: "Livraison gratuite",
      product: "Article offert",
      points: `${form.gift_value} points fidélité`,
    };
    const send = async () => {
      if (!uid) {
        setErr("Sélectionnez un client.");
        return;
      }
      setSending(true);
      setErr(null);
      try {
        await api.post("/analytics/gifts/", {
          user_id: uid,
          gift_type: form.gift_type,
          gift_value: form.gift_value,
          gift_details: form.gift_details || defs[form.gift_type ?? "discount"],
          valid_days: form.valid_days,
          admin_note: form.admin_note || `Campagne ${segment.segment}`,
        });
        setSent(eligible.find((c) => c.user_id === uid)?.email ?? uid);
        onSent(uid);
      } catch (e: any) {
        setErr(e?.response?.data?.error ?? "Erreur d'envoi.");
      } finally {
        setSending(false);
      }
    };
    const sendAll = async () => {
      if (!eligible.length) return;
      setSending(true);
      let ok = 0;
      for (const c of eligible.slice(0, 50)) {
        try {
          await api.post("/analytics/gifts/", {
            user_id: c.user_id,
            gift_type: form.gift_type,
            gift_value: form.gift_value,
            gift_details:
              form.gift_details || defs[form.gift_type ?? "discount"],
            valid_days: form.valid_days,
            admin_note: `Campagne ${segment.segment} — batch`,
          });
          onSent(c.user_id);
          ok++;
        } catch {}
      }
      setSent(`${ok} client(s) sur ${Math.min(eligible.length, 50)}`);
      setSending(false);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-gognet-navy border border-gognet-border-dark rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div
            className={`flex items-center justify-between p-5 border-b border-gognet-border-dark ${conf.tw} rounded-t-2xl`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{conf.icon}</span>
              <div>
                <h3 className={`text-[14px] font-black ${conf.text}`}>
                  Campagne — {segment.segment_label.replace(/^[^\s]+\s/, "")}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {eligible.length} clients éligibles
                </p>
              </div>
            </div>
            <button
              title="Fermer"
              onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <FiX size={18} />
            </button>
          </div>
          {sent ? (
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                <FiCheckCircle size={28} className="text-emerald-400" />
              </div>
              <h4 className="font-bold text-emerald-400 text-[15px] mb-1">
                Offre envoyée !
              </h4>
              <p className="text-[12px] text-slate-500 mb-4">
                Destinataire : <strong className="text-white">{sent}</strong>
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => {
                    setSent(null);
                    setUid("");
                  }}
                  className="px-4 py-2 bg-emerald-500/15 text-emerald-400 rounded-xl text-[13px] font-semibold border border-emerald-500/30 hover:bg-emerald-500/25 transition-all"
                >
                  Autre envoi
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-white/5 text-slate-400 rounded-xl text-[13px] font-semibold border border-gognet-border-dark hover:bg-white/10 transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div
                className={`rounded-xl border p-3 ${conf.tw} ${conf.border}`}
              >
                <p className="text-[11px] text-slate-400">
                  <strong className={conf.text}>CRM :</strong>{" "}
                  {segment.action_crm}
                </p>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 mb-2 block uppercase tracking-wide">
                  Type de cadeau
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {GIFT_TYPES.map((g) => (
                    <button
                      key={g.value}
                      onClick={() =>
                        setForm((f) => ({ ...f, gift_type: g.value as any }))
                      }
                      className={`text-left text-[11px] px-3 py-2 rounded-xl border transition-all font-medium ${
                        form.gift_type === g.value
                          ? `${conf.border} ${conf.tw} ${conf.text} border-2`
                          : "border-gognet-border-dark text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              {form.gift_type !== "shipping" && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 mb-2 block uppercase tracking-wide">
                    Valeur
                  </label>
                  <input
                    type="number"
                    min={0}
                    title="Valeur du cadeau"
                    value={form.gift_value}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, gift_value: +e.target.value }))
                    }
                    className="w-full bg-white/5 border border-gognet-border-dark rounded-xl px-3 py-2 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              )}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 mb-2 block uppercase tracking-wide">
                  Validité
                </label>
                <div className="flex gap-2">
                  {[3, 7, 14, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => setForm((f) => ({ ...f, valid_days: d }))}
                      className={`flex-1 text-[12px] py-1.5 rounded-xl border font-bold transition-all ${
                        form.valid_days === d
                          ? `${conf.border} ${conf.tw} ${conf.text}`
                          : "border-gognet-border-dark text-slate-500 hover:border-slate-500"
                      }`}
                    >
                      {d}j
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 mb-2 block uppercase tracking-wide">
                  Client cible (optionnel)
                </label>
                <select
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  title="Client"
                  className="w-full bg-white/5 border border-gognet-border-dark rounded-xl px-3 py-2 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  <option value="">— Sélectionner un client —</option>
                  {eligible.slice(0, 100).map((c) => (
                    <option key={c.user_id} value={c.user_id}>
                      {c.first_name || c.last_name
                        ? `${c.first_name} ${c.last_name}`.trim()
                        : `#${c.user_id}`}{" "}
                      · {c.email ?? ""} · {fmt(c.monetary, 2)} DT
                    </option>
                  ))}
                </select>
              </div>
              {err && (
                <div className="flex items-center gap-2 text-[12px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                  <FiAlertTriangle size={13} />
                  {err}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={send}
                  disabled={sending || !uid}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gognet-teal hover:bg-gognet-teal-dark text-white text-[13px] font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <FiRefreshCw size={14} className="animate-spin" />
                  ) : (
                    <FiSend size={14} />
                  )}{" "}
                  Envoyer
                </button>
                <button
                  onClick={sendAll}
                  disabled={sending || !eligible.length}
                  className="flex items-center gap-1.5 px-3 py-2.5 border border-gognet-border-dark text-[12px] font-semibold text-slate-400 rounded-xl hover:bg-white/5 transition-all disabled:opacity-50"
                >
                  <FiGift size={13} /> Tout le segment
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

// CRM Panel
function CRMPanel({
  segments,
  customers,
}: {
  segments: SegmentStat[];
  customers: Customer[];
}) {
  const [modal, setModal] = useState<SegmentStat | null>(null);
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  const handleSent = useCallback(
    (uid: string) => setSentMap((m) => ({ ...m, [uid]: true })),
    [],
  );
  return (
    <>
      <div className="space-y-4">
        <Card>
          <SectionHead
            title="Actions CRM recommandées"
            badge={`${Object.keys(sentMap).length} offre(s) envoyée(s)`}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {segments.map((sg) => {
              const conf = SEG[sg.segment] ?? SEG.nouveau;
              const eligN = customers.filter(
                (c) => c.segment === sg.segment && !c.existing_gift,
              ).length;
              return (
                <div
                  key={sg.segment}
                  className={`rounded-2xl border p-4 ${conf.tw} ${conf.border}`}
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xl">{conf.icon}</span>
                    <span className={`text-[12px] font-bold ${conf.text}`}>
                      {sg.segment_label}
                    </span>
                    <span className="ml-auto text-[10px] bg-white/10 px-2 py-0.5 rounded-lg font-semibold text-slate-400">
                      {sg.n_clients} clients · {sg.pct_revenue}% CA
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-400 leading-relaxed mb-3">
                    {sg.action_crm}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setModal(sg)}
                      className={`flex items-center gap-1.5 text-[12px] font-bold px-3 py-2 rounded-xl bg-white/5 border ${conf.border} ${conf.text} hover:bg-white/10 transition-all`}
                    >
                      <FiMail size={11} /> Lancer la campagne
                    </button>
                    {eligN > 0 && (
                      <span className="text-[10px] text-slate-500">
                        {eligN} éligibles
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ElbowChart />
          <PCAChart />
        </div>
        <RadarRFM segments={segments} />
      </div>
      {modal && (
        <GiftModal
          segment={modal}
          customers={customers}
          onClose={() => setModal(null)}
          onSent={handleSent}
        />
      )}
    </>
  );
}

// Diagnostic modèle
const ModelDiag = memo(
  ({ stats, health }: { stats: GlobalStats | null; health: any }) => {
    const segSys = health?.seg_sys;
    const meta = segSys?.model_meta;
    const files = segSys?.files;
    return (
      <div className="space-y-4">
        <Card>
          <SectionHead title="Diagnostic modèle K-Means" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            {[
              {
                k: "Statut",
                v: segSys?.loaded ? "✅ Chargé" : "❌ Non chargé",
              },
              {
                k: "Version",
                v: meta?.model_version ?? stats?.model_version ?? "—",
              },
              { k: "K clusters", v: meta?.k ?? stats?.k ?? 4 },
              {
                k: "Silhouette",
                v: meta?.silhouette
                  ? (+meta.silhouette).toFixed(4)
                  : (stats?.silhouette_score?.toFixed(4) ?? "—"),
              },
              {
                k: "Entraîné sur",
                v: meta?.n_train
                  ? `${Number(meta.n_train).toLocaleString()} cmd`
                  : "—",
              },
              {
                k: "Entraîné le",
                v: meta?.trained_at
                  ? new Date(meta.trained_at).toLocaleDateString("fr-FR")
                  : "—",
              },
            ].map(({ k, v }) => (
              <div
                key={k}
                className="bg-white/3 border border-gognet-border-dark rounded-xl p-3"
              >
                <p className="text-[10px] text-slate-500 uppercase font-bold">
                  {k}
                </p>
                <p className="text-[13px] font-bold text-white mt-0.5">
                  {String(v)}
                </p>
              </div>
            ))}
          </div>
          {files && (
            <>
              <p className="text-[11px] font-bold text-slate-500 mb-3 uppercase tracking-wide">
                Fichiers modèles
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(files).map(([f, ok]) => (
                  <div
                    key={f}
                    className={`flex items-center gap-2.5 rounded-xl px-4 py-3 border text-[12px] ${
                      ok
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-red-500/30 bg-red-500/5"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white ${ok ? "bg-emerald-500" : "bg-red-500"}`}
                    >
                      {ok ? "✓" : "✗"}
                    </span>
                    <span
                      className={`font-mono font-medium ${ok ? "text-emerald-300" : "text-red-300"}`}
                    >
                      {f}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ElbowChart />
          <PCAChart />
        </div>
      </div>
    );
  },
);

// ── Main ──────────────────────────────────────────────────────────────────────
type BehTab = "overview" | "table" | "crm" | "diagnostic";

export default function SegmentDashboard() {
  const T = useAdminTheme();
  const dispatch = useDispatch<AppDispatch>();
  const mlHealth = useSelector(selectMLHealth) as any;
  const segLoaded = useSelector(selectSegSysLoaded);

  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [customers, setCustomers] = useState<CustomerList | null>(null);
  const [loading, setLoading] = useState(true);
  const [custLoading, setCustLoading] = useState(false);
  const [resegLoading, setResegLoading] = useState(false);
  const [resegMsg, setResegMsg] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [segFilter, setSegFilter] = useState("");
  const [activeTab, setActiveTab] = useState<BehTab>("overview");

  useEffect(() => {
    dispatch(fetchMLHealth());
  }, [dispatch]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/analytics/segments-stats/");
      setStats(res.data);
      setError("");
    } catch {
      try {
        const r = await fetch(`${ML_URL}/ml/segments-stats`);
        setStats(await r.json());
        setError("");
      } catch {
        setError("Impossible de charger les statistiques.");
      }
    }
  }, []);

  const fetchCustomers = useCallback(async (pg: number, seg: string) => {
    setCustLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pg),
        page_size: String(PAGE_SIZE),
        ...(seg ? { segment: seg } : {}),
      });
      let data: CustomerList;
      try {
        const r = await api.get(`/analytics/customers/?${params}`);
        data = r.data;
      } catch {
        const r = await fetch(`${ML_URL}/ml/segments-list?${params}`);
        data = await r.json();
      }
      setCustomers(data);
    } catch {
      setCustomers(null);
    } finally {
      setCustLoading(false);
    }
  }, []);

  // FIX: fetchAllCustomers — charge TOUS les clients sans pagination
  // pour alimenter GiftModal (PAGE_SIZE=15 était trop restrictif → eligible=0)
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const fetchAllCustomers = useCallback(async () => {
    try {
      let list: Customer[] = [];
      try {
        const r = await api.get(`/analytics/customers/?page=1&page_size=500`);
        list = r.data?.customers ?? [];
      } catch {
        const r = await fetch(
          `${ML_URL}/ml/segments-list?page=1&page_size=500`,
        );
        const d = await r.json();
        list = d?.customers ?? [];
      }
      setAllCustomers(list);
    } catch {
      setAllCustomers([]);
    }
  }, []);

  const handleResegment = async () => {
    setResegLoading(true);
    setResegMsg("⏳ Resegmentation en cours…");
    try {
      await api.post("/analytics/resegment/");
    } catch {
      try {
        await fetch(`${ML_URL}/ml/resegment`);
      } catch {
        setResegMsg("❌ Erreur lors du déclenchement.");
        setResegLoading(false);
        return;
      }
    }
    // Attendre 8s que la tâche background PostgreSQL se termine
    setResegMsg("⏳ Mise à jour de la segmentation (8s)…");
    await new Promise((r) => setTimeout(r, 8000));
    await Promise.all([
      fetchStats(),
      fetchCustomers(1, ""),
      fetchAllCustomers(),
    ]);
    setResegMsg("✅ Resegmentation terminée — données mises à jour.");
    setResegLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchCustomers(1, "")]).finally(() =>
      setLoading(false),
    );
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === "table") fetchCustomers(page, segFilter);
  }, [activeTab, page, segFilter, fetchCustomers]);
  useEffect(() => {
    if (activeTab === "crm") {
      if (!customers) fetchCustomers(1, "");
      if (allCustomers.length === 0) fetchAllCustomers();
    }
  }, [
    activeTab,
    customers,
    allCustomers.length,
    fetchCustomers,
    fetchAllCustomers,
  ]);

  const filteredCustomers = useMemo(
    () =>
      customers?.customers.filter((c) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          c.email?.toLowerCase().includes(q) ||
          c.first_name?.toLowerCase().includes(q) ||
          c.last_name?.toLowerCase().includes(q) ||
          c.user_id?.includes(q)
        );
      }) ?? [],
    [customers, search],
  );

  const segments = useMemo<SegmentStat[]>(() => {
    const ml = stats?.segments ?? [];
    if (ml.length) return ml;
    if (!customers?._fallback || !customers.customers.length) return [];
    const CRM: Record<
      string,
      { label: string; color: string; action: string; cid: number }
    > = {
      champions: {
        label: "🏆 Champions",
        color: "#10B981",
        action: "Offrir accès anticipé ou réduction VIP.",
        cid: 0,
      },
      loyaux: {
        label: "💙 Clients Loyaux",
        color: "#3B82F6",
        action: "Programme fidélité et offres personnalisées.",
        cid: 1,
      },
      a_risque: {
        label: "⚠️ À Risque / Perdus",
        color: "#F59E0B",
        action: "Campagne réactivation urgente — bon de réduction 15-30%.",
        cid: 2,
      },
      a_risque_perdus: {
        label: "⚠️ À Risque / Perdus",
        color: "#F59E0B",
        action: "Campagne réactivation urgente — bon de réduction 15-30%.",
        cid: 2,
      },
    };
    const groups: Record<string, Customer[]> = {};
    for (const c of customers.customers)
      (groups[(c.segment ??= "a_risque")] ??= []).push(c);
    const totRev =
      customers.customers.reduce((s, c) => s + Number(c.monetary ?? 0), 0) || 1;
    const totCli = customers.total || 1;
    return Object.entries(groups).map(([seg, arr]) => {
      const m = CRM[seg] ?? CRM.a_risque;
      const avg = (fn: (c: Customer) => number) =>
        arr.length
          ? +(arr.reduce((s, c) => s + fn(c), 0) / arr.length).toFixed(2)
          : 0;
      const segMon = arr.reduce((s, c) => s + Number(c.monetary ?? 0), 0);
      return {
        cluster_id: m.cid,
        segment: seg,
        segment_label: m.label,
        color: m.color,
        action_crm: m.action,
        n_clients: arr.length,
        pct_clients: +((arr.length / totCli) * 100).toFixed(1),
        recency_avg: avg((c) => Number(c.recency_days ?? 0)),
        frequency_avg: avg((c) => Number(c.frequency ?? 0)),
        monetary_avg: avg((c) => Number(c.monetary ?? 0)),
        monetary_total: +segMon.toFixed(2),
        pct_revenue: +((segMon / totRev) * 100).toFixed(1),
        last_computed: arr[0]?.computed_at ?? null,
      } satisfies SegmentStat;
    });
  }, [stats, customers]);

  const statusCls =
    mlHealth?.status === "ok"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : mlHealth?.status === "partial"
        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
        : "bg-red-500/10 text-red-400 border-red-500/30";

  if (loading)
    return (
      <div
        className="ml-dashboard-root flex flex-col items-center justify-center py-24 gap-3 min-h-screen"
        // style={{ background: T.bg, color: T.text }}
        // style={{ background: T.isDark ? undefined : "#F1F5F9", color: T.text }}
        style={{
          background: T.isDark ? T.bg : "#F1F5F9",
          color: T.text,
        }}
      >
        <Spinner />
        <p className="text-[13px] text-slate-500">
          Chargement de la segmentation RFM…
        </p>
      </div>
    );

  const TABS: { id: BehTab; label: string }[] = [
    { id: "overview", label: "Vue d'ensemble" },
    { id: "table", label: "Clients" },
    { id: "crm", label: "Actions CRM" },
    { id: "diagnostic", label: "Diagnostic" },
  ];

  return (
    <div
      className="ml-dashboard-root bg-gognet-dark min-h-screen p-4 sm:p-6 lg:p-8 font-sans space-y-5"
      style={
        {
          background: T.isDark ? undefined : T.bg,
          color: T.text,
          "--chart-border": T.isDark ? "#1E293B" : "#E2E8F0",
          "--chart-bg": T.isDark ? "#0B1120" : "#F8FAFC",
          "--chart-bg2": T.isDark ? "#0F172A" : "#FFFFFF",
        } as React.CSSProperties
      }
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
      {/* ── Header ── */}
      <div className="bg-gognet-navy border border-gognet-border-dark rounded-2xl p-5">
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <FiUsers className="text-white text-lg" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-black text-[20px] text-white tracking-tight">
                  BehaSys <span className="text-emerald-400">ML</span>
                </h2>

                <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  RFM · K-Means
                </span>
              </div>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Segmentation comportementale — {fmt(stats?.total_clients ?? 0)}{" "}
                clients analysés
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {mlHealth && (
              <span
                className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border ${statusCls}`}
              >
                {segLoaded ? (
                  <FiCheckCircle size={11} />
                ) : (
                  <FiAlertTriangle size={11} />
                )}
                SegSys {segLoaded ? "ok" : String(mlHealth.status ?? "—")}
              </span>
            )}
            <button
              onClick={handleResegment}
              disabled={resegLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-gognet-teal hover:bg-gognet-teal-dark text-white text-[12px] font-bold rounded-xl transition-all disabled:opacity-60"
            >
              <FiRefreshCw
                size={13}
                className={resegLoading ? "animate-spin" : ""}
              />
              {resegLoading ? "Resegmentation…" : "Resegmenter"}
            </button>
          </div>
        </div>
        {resegMsg && (
          <div
            className={`mt-3 text-[12px] px-3 py-2 rounded-xl font-medium border ${resegMsg.startsWith("✅") ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}
          >
            {resegMsg}
          </div>
        )}
        {error && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
            <FiAlertTriangle size={13} /> {error}
          </div>
        )}
        {/* Sub-nav */}
        <div className="flex gap-1 mt-5 border-b border-gognet-border-dark overflow-x-auto scrollbar-hide pb-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === t.id
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<FiUsers size={18} />}
          label="Clients segmentés"
          value={fmt(stats?.total_clients ?? 0)}
          sub={`${segments.length} segments actifs`}
          color="bg-gradient-to-br from-emerald-500 to-teal-600"
        />
        <KpiCard
          icon={<FiDollarSign size={18} />}
          label="CA analysé"
          value={`${fmt(stats?.total_revenue ?? 0, 0)} DT`}
          sub="Commandes DELIVERED"
          color="bg-gradient-to-br from-amber-500 to-orange-500"
        />
        <KpiCard
          icon={<FiActivity size={18} />}
          label="Silhouette Score"
          value={stats?.silhouette_score?.toFixed(4) ?? "—"}
          sub="≥ 0.35 = acceptable"
          color="bg-gradient-to-br from-violet-500 to-purple-600"
        />
        <KpiCard
          icon={<FiCpu size={18} />}
          label="K-Means K"
          value={stats?.k ?? 3}
          sub={stats?.model_version ?? "kmeans_olist_v1_k3"}
          color="bg-gradient-to-br from-blue-500 to-indigo-600"
        />
      </div>

      {/* ── VUE D'ENSEMBLE ── */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {segments.map((sg) => {
              const conf = SEG[sg.segment] ?? SEG.nouveau;
              return (
                <div
                  key={sg.segment}
                  className={`bg-gognet-dark border rounded-2xl p-4 ${conf.border}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{conf.icon}</span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${conf.badge} border ${conf.border}`}
                    >
                      {sg.pct_clients}%
                    </span>
                  </div>
                  <p className={`text-[13px] font-bold ${conf.text}`}>
                    {sg.segment_label.replace(/^[^\s]+\s/, "")}
                  </p>
                  <p className="text-2xl font-black text-white mt-1">
                    {fmt(sg.n_clients)}
                  </p>
                  <p className="text-[11px] text-slate-500">clients</p>
                  <div className="mt-3 pt-3 border-t border-gognet-border-dark grid grid-cols-3 gap-1 text-center">
                    <div>
                      <p className="text-[10px] text-slate-500">Recency</p>
                      <p className="text-[12px] font-bold text-white">
                        {sg.recency_avg.toFixed(0)}j
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Freq.</p>
                      <p className="text-[12px] font-bold text-white">
                        {sg.frequency_avg.toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Moy.</p>
                      <p className="text-[12px] font-bold text-white">
                        {fmt(sg.monetary_avg, 0)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>CA</span>
                      <span className="font-bold text-white">
                        {sg.pct_revenue}%
                      </span>
                    </div>
                    <div className="bg-white/5 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all duration-700"
                        style={{
                          width: `${sg.pct_revenue}%`,
                          backgroundColor: sg.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <SectionHead title="Répartition clients" />
              <DonutChart segments={segments} />
            </Card>
            <Card>
              <SectionHead title="Métriques RFM moyennes" />
              <div className="space-y-5">
                <HBar
                  segments={segments}
                  field="recency_avg"
                  label="Recency (jours — moins = meilleur)"
                  suffix="j"
                />
                <HBar
                  segments={segments}
                  field="frequency_avg"
                  label="Frequency (commandes)"
                  suffix=""
                />
                <HBar
                  segments={segments}
                  field="monetary_avg"
                  label="Monetary moyen (DT)"
                  suffix=" DT"
                />
              </div>
            </Card>
          </div>

          {/* Barres CA */}
          <Card>
            <SectionHead title="Contribution au CA par segment" />
            <div className="flex gap-3 items-end h-28 px-2 mt-10">
              {segments.map((sg) => (
                <div
                  key={sg.segment}
                  className="flex-1 flex flex-col items-center gap-1 min-w-0"
                >
                  <span className="text-[11px] font-bold text-white">
                    {sg.pct_revenue}%
                  </span>
                  <div
                    className="w-full rounded-t-lg transition-all duration-700"
                    style={{
                      height: `${Math.max((sg.pct_revenue / Math.max(...segments.map((s) => s.pct_revenue))) * 88, 6)}px`,
                      backgroundColor: sg.color,
                    }}
                  />
                  <span className="text-[11px] text-slate-500">
                    {(SEG[sg.segment] ?? SEG.nouveau).icon}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-1 px-2">
              {segments.map((sg) => (
                <div
                  key={sg.segment}
                  className="flex-1 text-center text-[10px] text-slate-600 font-mono truncate"
                >
                  {fmt(sg.monetary_total, 0)} DT
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── TABLE CLIENTS ── */}
      {activeTab === "table" && (
        <div className="bg-gognet-dark border border-gognet-border-dark rounded-2xl overflow-hidden">
          <div className="flex flex-wrap gap-3 items-center p-4 border-b border-gognet-border-dark">
            <div className="relative flex-1 min-w-[200px]">
              <FiSearch
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                size={14}
              />
              <input
                type="text"
                placeholder="Email, nom…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-[13px] bg-white/5 border border-gognet-border-dark rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>
            <div className="flex items-center gap-2">
              <FiFilter size={13} className="text-slate-500" />
              <select
                title="Segment"
                value={segFilter}
                onChange={(e) => {
                  setSegFilter(e.target.value);
                  setPage(1);
                }}
                className="text-[13px] bg-white/5 border border-gognet-border-dark rounded-xl px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <option value="">Tous les segments</option>
                <option value="champions">🏆 Champions</option>
                <option value="loyaux">💙 Loyaux</option>
                <option value="a_risque_perdus">⚠️ À risque / Perdus</option>
              </select>
            </div>
            <button
              onClick={() => fetchCustomers(page, segFilter)}
              title="Rafraîchir"
              className="p-2 text-slate-500 hover:text-white transition-colors"
            >
              <FiRefreshCw size={14} />
            </button>
            {customers && (
              <span className="text-[11px] text-slate-600 ml-auto">
                {customers.total} clients · p.{page}/{customers.total_pages}
              </span>
            )}
          </div>

          {custLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] min-w-[640px]">
                <thead>
                  <tr className="border-b border-gognet-border-dark">
                    {[
                      "Client",
                      "Segment",
                      "Recency",
                      "Fréquence",
                      "Montant DT",
                      "Moy. cmd",
                      "Calculé le",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gognet-border-dark/50">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-12 text-slate-600 text-[13px]"
                      >
                        Aucun client trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => (
                      <tr
                        key={c.user_id}
                        className="hover:bg-white/3 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-white">
                            {c.first_name || c.last_name
                              ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()
                              : `#${c.user_id}`}
                          </p>
                          <p className="text-slate-500 text-[11px]">
                            {c.email ?? "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <SegBadge
                            segment={c.segment}
                            label={c.segment_label}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-300">
                          {c.recency_days != null ? `${c.recency_days}j` : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-300">
                          {c.frequency}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-white">
                          {fmt(c.monetary, 2)}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">
                          {c.avg_order_value ? fmt(c.avg_order_value, 2) : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {fmtDate(c.computed_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {customers && customers.total_pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gognet-border-dark">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || custLoading}
                className="flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-white disabled:opacity-40 transition-colors"
              >
                <FiChevronLeft size={14} /> Précédent
              </button>
              <div className="flex gap-1">
                {Array.from(
                  { length: Math.min(5, customers.total_pages) },
                  (_, i) => {
                    const pg =
                      Math.max(
                        1,
                        Math.min(page - 2, customers.total_pages - 4),
                      ) + i;
                    return (
                      <button
                        key={pg}
                        onClick={() => setPage(pg)}
                        title={`Page ${pg}`}
                        className={`w-7 h-7 text-[11px] rounded-lg font-bold transition-all ${pg === page ? "bg-emerald-500 text-white" : "text-slate-500 hover:bg-white/5"}`}
                      >
                        {pg}
                      </button>
                    );
                  },
                )}
              </div>
              <button
                onClick={() =>
                  setPage((p) => Math.min(customers.total_pages, p + 1))
                }
                disabled={page >= customers.total_pages || custLoading}
                className="flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-white disabled:opacity-40 transition-colors"
              >
                Suivant <FiChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── CRM ── */}
      {activeTab === "crm" && (
        <>
          {customers?._fallback && (
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 text-[12px] text-amber-400">
              <FiAlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>
                <strong>Mode RFM simplifié :</strong> La segmentation K-Means
                n'est pas encore disponible. Classification par calcul RFM
                direct sur les commandes livrées.
              </span>
            </div>
          )}
          {/* FIX: allCustomers = tous les clients (500), sans limite de pagination */}
          <CRMPanel
            segments={segments}
            customers={
              allCustomers.length > 0
                ? allCustomers
                : (customers?.customers ?? [])
            }
          />
        </>
      )}

      {/* ── DIAGNOSTIC ── */}
      {activeTab === "diagnostic" && (
        <ModelDiag stats={stats} health={mlHealth} />
      )}

      <div className="text-center text-[11px] text-slate-600 py-2 font-mono">
        BehaSys ML Pro · Sprint S4 · GoGNet SmartShop ·{" "}
        {stats?.model_version ?? "kmeans_olist_v1_k4"} · K={stats?.k ?? 4} ·
        Silhouette={stats?.silhouette_score?.toFixed(4) ?? "—"}
      </div>
    </div>
  );
}
