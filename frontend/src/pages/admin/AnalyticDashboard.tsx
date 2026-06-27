// src/pages/admin/AnalyticDashboard.tsx — RecSys ML · GoGNet Design

import { useState, useEffect, useMemo, memo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "../../store";
import {
  fetchMLHealth,
  selectMLHealth,
  selectMLHealthLoading,
} from "../../store/slices/mlSlice";
import { useAdminTheme } from "./AdminDashboards";
import {
  FiCpu,
  FiTrendingUp,
  FiTarget,
  FiDownload,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertCircle,
  FiActivity,
  FiDatabase,
} from "react-icons/fi";

const TRUE_METRICS = {
  svd_base: {
    rmse: 0.7749,
    mae: 0.5421,
    label: "SVD baseline",
    color: "#F87171",
  },
  svd_opt: {
    rmse: 0.7116,
    mae: 0.4637,
    label: "SVD optimisé",
    color: "#FB923C",
  },
  ncf: { rmse: 0.7475, mae: 0.3792, label: "NCF NeuMF", color: "#A78BFA" },
  hybrid: { rmse: 0.582, mae: 0.42, label: "Hybride ★ BEST", color: "#34D399" },
};

// Historique NCF complet — 30 epochs (valeurs réelles notebook)
const NCF_HISTORY = [
  { ep: 1, tl: 0.0902, vl: 0.0518, tm: 0.2404, vm: 0.1559 },
  { ep: 2, tl: 0.0452, vl: 0.0411, tm: 0.145, vm: 0.135 },
  { ep: 3, tl: 0.0359, vl: 0.0384, tm: 0.1265, vm: 0.1237 },
  { ep: 4, tl: 0.0326, vl: 0.0373, tm: 0.1161, vm: 0.1181 },
  { ep: 5, tl: 0.0296, vl: 0.0362, tm: 0.1079, vm: 0.1134 },
  { ep: 6, tl: 0.0262, vl: 0.0354, tm: 0.099, vm: 0.1096 },
  { ep: 7, tl: 0.0218, vl: 0.0346, tm: 0.0881, vm: 0.1051 },
  { ep: 8, tl: 0.0177, vl: 0.0347, tm: 0.0777, vm: 0.1031 },
  { ep: 9, tl: 0.0145, vl: 0.035, tm: 0.0684, vm: 0.1012 },
  { ep: 10, tl: 0.0122, vl: 0.035, tm: 0.0611, vm: 0.0991 },
  { ep: 11, tl: 0.0105, vl: 0.0353, tm: 0.0551, vm: 0.0994 },
  { ep: 12, tl: 0.0094, vl: 0.0357, tm: 0.0508, vm: 0.0987 },
  { ep: 13, tl: 0.0086, vl: 0.0358, tm: 0.0474, vm: 0.0981 },
  { ep: 14, tl: 0.0079, vl: 0.0361, tm: 0.0443, vm: 0.098 },
  { ep: 15, tl: 0.0074, vl: 0.0362, tm: 0.0416, vm: 0.0971 },
  { ep: 16, tl: 0.007, vl: 0.0365, tm: 0.0397, vm: 0.0973 },
  { ep: 17, tl: 0.0067, vl: 0.0366, tm: 0.0382, vm: 0.0972 },
  { ep: 18, tl: 0.0065, vl: 0.0366, tm: 0.037, vm: 0.0966 },
  { ep: 19, tl: 0.0063, vl: 0.0367, tm: 0.0358, vm: 0.0968 },
  { ep: 20, tl: 0.0061, vl: 0.0368, tm: 0.0346, vm: 0.0964 },
  { ep: 21, tl: 0.0059, vl: 0.037, tm: 0.0335, vm: 0.0965 },
  { ep: 22, tl: 0.0058, vl: 0.037, tm: 0.0329, vm: 0.0963 },
  { ep: 23, tl: 0.0057, vl: 0.0371, tm: 0.0323, vm: 0.0963 },
  { ep: 24, tl: 0.0056, vl: 0.0374, tm: 0.0314, vm: 0.096 },
  { ep: 25, tl: 0.0054, vl: 0.0377, tm: 0.0306, vm: 0.0964 },
  { ep: 26, tl: 0.0054, vl: 0.0374, tm: 0.0304, vm: 0.096 },
  { ep: 27, tl: 0.0053, vl: 0.0375, tm: 0.0298, vm: 0.0962 },
  { ep: 28, tl: 0.005, vl: 0.0374, tm: 0.0279, vm: 0.095 },
  { ep: 29, tl: 0.0048, vl: 0.0373, tm: 0.0264, vm: 0.0948 }, // ← best val_mae
  { ep: 30, tl: 0.0046, vl: 0.0375, tm: 0.0256, vm: 0.0949 },
];

// Ranking @K — valeurs réelles notebook (threshold=3.5)
const RANKING_DATA = {
  precision: {
    label: "Precision@K",
    data: [
      { k: "@5", SVD: 0.7831, NCF: 0.7843, Hybride: 0.7879 },
      { k: "@10", SVD: 0.7765, NCF: 0.7782, Hybride: 0.7784 },
      { k: "@20", SVD: 0.7758, NCF: 0.7773, Hybride: 0.7773 },
    ],
  },
  recall: {
    label: "Recall@K",
    data: [
      { k: "@5", SVD: 0.8384, NCF: 0.8395, Hybride: 0.8428 },
      { k: "@10", SVD: 0.8692, NCF: 0.8703, Hybride: 0.8705 },
      { k: "@20", SVD: 0.871, NCF: 0.8722, Hybride: 0.8722 },
    ],
  },
  ndcg: {
    label: "NDCG@K",
    data: [
      { k: "@5", SVD: 0.8526, NCF: 0.8538, Hybride: 0.8661 },
      { k: "@10", SVD: 0.8523, NCF: 0.8536, Hybride: 0.8657 },
      { k: "@20", SVD: 0.8522, NCF: 0.8536, Hybride: 0.8657 },
    ],
  },
  map: {
    label: "MAP",
    data: [
      { k: "@5", SVD: 0.843, NCF: 0.8447, Hybride: 0.8621 },
      { k: "@10", SVD: 0.8416, NCF: 0.8436, Hybride: 0.8609 },
      { k: "@20", SVD: 0.8415, NCF: 0.8435, Hybride: 0.8608 },
    ],
  },
};

// Heatmap alpha — valeurs exactes notebook
const HEATMAP = [
  {
    alpha_svd: 0.3,
    values: [
      { cf: 0.6, rmse: 0.582, best: true },
      { cf: 0.7, rmse: 0.6153 },
      { cf: 0.8, rmse: 0.6504 },
      { cf: 0.9, rmse: 0.6873 },
    ],
  },
  {
    alpha_svd: 0.4,
    values: [
      { cf: 0.6, rmse: 0.5995 },
      { cf: 0.7, rmse: 0.6367 },
      { cf: 0.8, rmse: 0.6759 },
      { cf: 0.9, rmse: 0.7169 },
    ],
  },
  {
    alpha_svd: 0.5,
    values: [
      { cf: 0.6, rmse: 0.6231 },
      { cf: 0.7, rmse: 0.6659 },
      { cf: 0.8, rmse: 0.7108 },
      { cf: 0.9, rmse: 0.7576 },
    ],
  },
  {
    alpha_svd: 0.6,
    values: [
      { cf: 0.6, rmse: 0.6523 },
      { cf: 0.7, rmse: 0.7019 },
      { cf: 0.8, rmse: 0.7539 },
      { cf: 0.9, rmse: 0.8079 },
    ],
  },
  {
    alpha_svd: 0.7,
    values: [
      { cf: 0.6, rmse: 0.6862 },
      { cf: 0.7, rmse: 0.7438 },
      { cf: 0.8, rmse: 0.8039 },
      { cf: 0.9, rmse: 0.866 },
    ],
  },
];

// Distribution catégories du dataset
const DIST_CATEGORIES: Record<string, number> = {
  Automobile: 10122,
  Beauté: 9162,
  Réseaux: 8639,
  Électronique: 8382,
  Livres: 8326,
  "Jeux vidéo": 7393,
  Sports: 6944,
  Maison: 6812,
};

// Radar normalisé — calibré sur métriques réelles (0-100)
// RMSE/MAE : score = max(0, 100 - valeur * 100) inversé
// Ranking : score = valeur * 100
const RADAR_DATA = [
  {
    metric: "RMSE ↓",
    SVD: Math.round((1 - 0.7116) * 100),
    NCF: Math.round((1 - 0.7475) * 100),
    Hybride: Math.round((1 - 0.582) * 100),
  },
  {
    metric: "MAE ↓",
    SVD: Math.round((1 - 0.4637) * 100),
    NCF: Math.round((1 - 0.3792) * 100),
    Hybride: Math.round((1 - 0.42) * 100),
  },
  {
    metric: "Prec@10",
    SVD: Math.round(0.7765 * 100),
    NCF: Math.round(0.7782 * 100),
    Hybride: Math.round(0.7784 * 100),
  },
  {
    metric: "NDCG@5",
    SVD: Math.round(0.8526 * 100),
    NCF: Math.round(0.8538 * 100),
    Hybride: Math.round(0.8661 * 100),
  },
  {
    metric: "MAP@5",
    SVD: Math.round(0.843 * 100),
    NCF: Math.round(0.8447 * 100),
    Hybride: Math.round(0.8621 * 100),
  },
  {
    metric: "Recall@10",
    SVD: Math.round(0.8692 * 100),
    NCF: Math.round(0.8703 * 100),
    Hybride: Math.round(0.8705 * 100),
  },
];

// ── Export rapport ───────────────────────────────────────────────────────
function exportReport() {
  const lines = [
    "══════════════════════════════════════════════════════════════",
    "  RAPPORT — RecSys ML Pro — GoGNet SmartShop — Sprint S3",
    `  Généré le ${new Date().toLocaleString("fr-FR")}`,
    "══════════════════════════════════════════════════════════════",
    "",
    "── DATASET ───────────────────────────────────────────────────",
    "SmartShop : 16 931 interactions · 1 333 users · 37 produits",
    "Amazon Kaggle : 568 454 interactions · 256 059 users · 74 258 produits",
    "Dataset final (filtré) : 90 753 inter. · 5 982 users · 2 000 produits",
    "Sparsité : 99.24% | Train/Test : 72 602 / 18 151 | Threshold : 3.5★",
    "",
    "── RÉSULTATS COMPARATIFS ─────────────────────────────────────",
    "Modèle          RMSE    MAE     Prec@10  Recall@10  NDCG@5   MAP@5",
    "SVD baseline    0.7749  0.5421  —        —          —        —",
    "SVD optimisé    0.7116  0.4637  0.7765   0.8692     0.8526   0.8430",
    "NCF (NeuMF)     0.7475  0.3792  0.7782   0.8703     0.8538   0.8447",
    "Hybride ★ BEST  0.5820  —       0.7784   0.8705     0.8661   0.8621",
    "",
    "Amélioration Hybride vs SVD baseline : RMSE -24.9% | MAE n/a",
    "Meilleure MAE : NCF → 0.3792 (-30.0% vs SVD baseline)",
    "",
    "── PARAMÈTRES HYBRIDES OPTIMAUX ──────────────────────────────",
    "alpha_svd=0.3 | alpha_cf=0.6 (Grid search sur 2 000 interactions)",
    "Décomposition : SVD 18% + NCF 42% + CB 40%",
    "",
    "── CONTENT-BASED TF-IDF ──────────────────────────────────────",
    "CB v1 (original) : Précision catégorielle 57.1%",
    "CB v2 (optimisé) : Précision catégorielle 78.1% (+21.0pp)",
    "Paramètres : max_features=1 500 · ngram_range=(1,3)",
    "",
    "── HYPERPARAMÈTRES NCF ───────────────────────────────────────",
    "SVD best : n_factors=100, n_epochs=30, lr_all=0.007, reg_all=0.06",
    "NCF : GMF(32) + MLP(32,[64,32,16]) · Dropout 0.2 · Adam lr=0.001→0.0005",
    "NCF entraîné 30 epochs · val_mae=0.0948 (ep29) · RMSE=0.7475 [1,5]",
    "══════════════════════════════════════════════════════════════",
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/plain;charset=utf-8",
  });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `GoGNet_RecSys_Rapport_${new Date().toISOString().slice(0, 10)}.txt`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Sous-composants ────────────────────────────────────────────────────

const DarkTooltip = memo(({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gognet-navy border border-gognet-border-dark rounded-xl p-3 text-xs text-gognet-text-light shadow-xl">
      <p className="font-bold text-gognet-indigo-light mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: p.color }}
          />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-semibold">
            {typeof p.value === "number" ? p.value.toFixed(4) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
});

const KpiCard = memo(
  ({
    label,
    value,
    sub,
    delta,
    deltaGood,
    icon,
    color,
  }: {
    label: string;
    value: string;
    sub: string;
    delta?: string;
    deltaGood?: boolean;
    icon?: React.ReactNode;
    color?: string;
  }) => (
    <div className="bg-gognet-dark border border-gognet-border-dark rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gognet-indigo to-transparent" />
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
          {label}
        </p>
        {icon && (
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color ?? "bg-indigo-500/20"}`}
          >
            <span className="text-gognet-indigo-light">{icon}</span>
          </div>
        )}
      </div>
      <p className="text-3xl font-black text-white leading-none mb-1">
        {value}
      </p>
      <p className="text-[12px] text-slate-500 mt-1">{sub}</p>
      {delta && (
        <p
          className={`text-[12px] font-semibold mt-1.5 flex items-center gap-1 ${deltaGood ? "text-gognet-success" : "text-gognet-warning"}`}
        >
          {delta}
        </p>
      )}
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
    <div className="flex items-center gap-3 mb-5">
      <h3 className="font-display font-bold text-[15px] text-white">{title}</h3>
      {badge && (
        <span className="text-[10px] bg-indigo-500/20 text-gognet-indigo-light border border-indigo-500/30 px-2.5 py-0.5 rounded-full font-bold">
          {badge}
        </span>
      )}
      {right && <div className="ml-auto">{right}</div>}
    </div>
  ),
);

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

const MetricsTable = memo(() => {
  const rows = [
    {
      ...TRUE_METRICS.svd_base,
      key: "svd_base",
      prec10: "—",
      recall10: "—",
      ndcg5: "—",
      map5: "—",
    },
    {
      ...TRUE_METRICS.svd_opt,
      key: "svd_opt",
      prec10: "77.65%",
      recall10: "86.92%",
      ndcg5: "0.8526",
      map5: "0.8430",
    },
    {
      ...TRUE_METRICS.ncf,
      key: "ncf",
      prec10: "77.82%",
      recall10: "87.03%",
      ndcg5: "0.8538",
      map5: "0.8447",
    },
    {
      ...TRUE_METRICS.hybrid,
      key: "hybrid",
      prec10: "77.84%",
      recall10: "87.05%",
      ndcg5: "0.8661 ★",
      map5: "0.8621 ★",
    },
  ];
  return (
    <div className="overflow-x-auto rounded-xl">
      <table className="w-full text-[12px] border-collapse min-w-[600px]">
        <thead>
          <tr className="border-b border-gognet-border-dark">
            {[
              "Modèle",
              "RMSE ↓",
              "MAE ↓",
              "Prec@10 ↑",
              "Recall@10 ↑",
              "NDCG@5 ↑",
              "MAP@5 ↑",
            ].map((h) => (
              <th
                key={h}
                className="text-left py-3 px-3 font-semibold text-slate-500 text-[11px] uppercase tracking-wide first:w-36"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isHybrid = r.key === "hybrid";
            const isBase = r.key === "svd_base";
            return (
              <tr
                key={r.key}
                className={`border-b border-gognet-border-dark/50 transition-colors ${isHybrid ? "bg-emerald-500/5" : "hover:bg-white/3"}`}
              >
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: r.color }}
                    />
                    <span
                      className={`font-medium ${isHybrid ? "text-emerald-400" : "text-slate-300"}`}
                    >
                      {r.label}
                    </span>
                    {isHybrid && (
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-black">
                        BEST
                      </span>
                    )}
                  </div>
                </td>
                <td
                  className={`py-3 px-3 font-mono font-semibold ${isBase ? "text-red-400" : isHybrid ? "text-emerald-400" : "text-slate-300"}`}
                >
                  {r.rmse.toFixed(4)}
                </td>
                <td
                  className={`py-3 px-3 font-mono font-semibold ${r.key === "ncf" ? "text-violet-400" : isBase ? "text-red-400" : "text-slate-300"}`}
                >
                  {r.mae.toFixed(4)}
                </td>
                <td className="py-3 px-3 font-mono text-slate-400">
                  {r.prec10}
                </td>
                <td className="py-3 px-3 font-mono text-slate-400">
                  {r.recall10}
                </td>
                <td className="py-3 px-3 font-mono text-slate-400">
                  {r.ndcg5}
                </td>
                <td className="py-3 px-3 font-mono text-slate-400">{r.map5}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[10px] text-slate-600 mt-2 italic">
        Évaluation sur 18 151 interactions test (80/20) · Amazon + SmartShop ·
        threshold pertinence = 3.5★
      </p>
    </div>
  );
});

const ErrorBars = memo(() => {
  const maxR = TRUE_METRICS.svd_base.rmse;
  const maxM = TRUE_METRICS.svd_base.mae;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] text-slate-500 mb-3 font-semibold uppercase tracking-wide">
          RMSE — plus bas = meilleur
        </p>
        {Object.values(TRUE_METRICS).map((m) => (
          <div key={m.label} className="flex items-center gap-3 mb-2.5">
            <span className="text-[12px] text-slate-400 w-24 flex-shrink-0 leading-none">
              {m.label}
            </span>
            <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(m.rmse / maxR) * 100}%`,
                  background: m.color,
                }}
              />
            </div>
            <span className="text-[12px] font-mono font-bold text-white w-12 text-right">
              {m.rmse.toFixed(4)}
            </span>
          </div>
        ))}
      </div>
      <div>
        <p className="text-[11px] text-slate-500 mb-3 font-semibold uppercase tracking-wide">
          MAE — plus bas = meilleur
        </p>
        {Object.values(TRUE_METRICS).map((m) => (
          <div key={m.label} className="flex items-center gap-3 mb-2.5">
            <span className="text-[12px] text-slate-400 w-24 flex-shrink-0 leading-none">
              {m.label}
            </span>
            <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(m.mae / maxM) * 100}%`,
                  background: m.color,
                }}
              />
            </div>
            <span className="text-[12px] font-mono font-bold text-white w-12 text-right">
              {m.mae.toFixed(4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

const StatusBadge = memo(
  ({ loaded, loading }: { loaded: boolean; loading: boolean }) => (
    <span
      className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border ${
        loading
          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
          : loaded
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            : "bg-red-500/10 text-red-400 border-red-500/30"
      }`}
    >
      {loading ? (
        <FiRefreshCw size={11} className="animate-spin" />
      ) : loaded ? (
        <FiCheckCircle size={11} />
      ) : (
        <FiAlertCircle size={11} />
      )}
      RecSys {loading ? "chargement…" : loaded ? "opérationnel" : "hors ligne"}
    </span>
  ),
);

// ── Composant principal ───────────────────────────────────────────────────────

type RecTab = "overview" | "training" | "ranking" | "hybrid" | "diagnostic";

export default function AnalyticDashboard() {
  const T = useAdminTheme();
  const dispatch = useDispatch<AppDispatch>();
  const mlHealth = useSelector(selectMLHealth) as any;
  const mlLoading = useSelector(selectMLHealthLoading);

  const [activeTab, setActiveTab] = useState<RecTab>("overview");
  const [rankingMetric, setRankingMetric] = useState<
    "precision" | "recall" | "ndcg" | "map"
  >("ndcg");

  useEffect(() => {
    dispatch(fetchMLHealth());
  }, [dispatch]);

  const recLoaded = useMemo(() => !!mlHealth?.rec_sys?.loaded, [mlHealth]);
  const hybridParams = useMemo(
    () => mlHealth?.rec_sys?.hybrid_params ?? { alpha_svd: 0.3, alpha_cf: 0.6 },
    [mlHealth],
  );
  const recFiles = useMemo(() => mlHealth?.rec_sys?.files ?? {}, [mlHealth]);

  const TABS: { id: RecTab; label: string }[] = [
    { id: "overview", label: "Vue d'ensemble" },
    { id: "training", label: "Entraînement NCF" },
    { id: "ranking", label: "Ranking @K" },
    { id: "hybrid", label: "Hybridation" },
    { id: "diagnostic", label: "Diagnostic" },
  ];

  return (
    <div
      className="ml-dashboard-root bg-gognet-dark min-h-screen p-4 sm:p-6 lg:p-8 font-sans space-y-5"
      style={{ background: T.isDark ? undefined : T.bg, color: T.text }}
    >
      {!T.isDark && (
        <style>{`
          .ml-dashboard-root .bg-gognet-dark { background: ${T.bg} !important; }
          .ml-dashboard-root .bg-gognet-navy { background: ${T.card} !important; }
          .ml-dashboard-root .bg-white\\/5, .ml-dashboard-root .bg-white\\/3, .ml-dashboard-root .bg-white\\/10 { background: ${T.active} !important; }
          .ml-dashboard-root .border-gognet-border-dark { border-color: ${T.border} !important; }
          .ml-dashboard-root .text-white, .ml-dashboard-root .text-slate-100, .ml-dashboard-root .text-slate-200 { color: ${T.text} !important; }
          .ml-dashboard-root .text-slate-300, .ml-dashboard-root .text-slate-400, .ml-dashboard-root .text-slate-500, .ml-dashboard-root .text-slate-600 { color: ${T.muted} !important; }
          .ml-dashboard-root input, .ml-dashboard-root select { background: ${T.inputBg} !important; color: ${T.text} !important; border-color: ${T.border} !important; }
          .ml-dashboard-root .rounded-2xl { box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        `}</style>
      )}

      {/* ── Header ── */}
      <div className="bg-gognet-navy border border-gognet-border-dark rounded-2xl p-5">
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-gognet-indigo to-violet-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <FiCpu className="text-white text-lg" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-black text-[20px] text-white tracking-tight">
                  RecSys <span className="text-gognet-indigo-light">ML</span>
                </h2>
                <span className="text-[10px] bg-indigo-500/20 text-gognet-indigo-light border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">
                  SVD · NCF · CB
                </span>
              </div>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Système de recommandation hybride — 90 753 interactions · 5 982
                users · 2 000 produits
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge loaded={recLoaded} loading={mlLoading} />
            <button
              onClick={exportReport}
              className="flex items-center gap-2 px-3 py-1.5 bg-gognet-indigo hover:bg-gognet-indigo-dark text-white text-[12px] font-bold rounded-xl transition-all"
            >
              <FiDownload size={13} /> Rapport
            </button>
            <button
              title="Rafraîchir"
              onClick={() => dispatch(fetchMLHealth())}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 text-[12px] font-bold rounded-xl border border-gognet-border-dark transition-all"
            >
              <FiRefreshCw size={13} />
            </button>
          </div>
        </div>
        <div className="flex gap-1 mt-5 border-b border-gognet-border-dark overflow-x-auto scrollbar-hide pb-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
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
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Meilleur RMSE"
          value="0.5820"
          sub="Hybride (α_svd=0.3, α_cf=0.6)"
          delta="−24.9% vs SVD baseline"
          deltaGood
          icon={<FiTrendingUp size={16} />}
          color="bg-emerald-500/15"
        />
        <KpiCard
          label="Meilleure MAE"
          value="0.3792"
          sub="NCF NeuMF (30 epochs)"
          delta="−30.0% vs SVD baseline"
          deltaGood
          icon={<FiActivity size={16} />}
          color="bg-violet-500/15"
        />
        <KpiCard
          label="NDCG@5 Hybride"
          value="0.866"
          sub="Best ranking metric"
          icon={<FiTarget size={16} />}
          color="bg-indigo-500/15"
        />
        <KpiCard
          label="Interactions"
          value="90 753"
          sub="5 982 users · 2 000 produits · 99.24% sparse"
          icon={<FiDatabase size={16} />}
          color="bg-cyan-500/15"
        />
      </div>

      {/* ── VUE D'ENSEMBLE ── */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <Card>
            <SectionHead
              title="Comparaison des modèles"
              badge="Métriques réelles notebook final"
            />
            <MetricsTable />
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <SectionHead
                title="Erreurs RMSE / MAE"
                badge="Comparaison visuelle"
              />
              <ErrorBars />
            </Card>
            <Card>
              <SectionHead
                title="Profil de performance"
                badge="Radar multi-métriques"
              />
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={RADAR_DATA}>
                  <PolarGrid stroke="var(--chart-border, #1E293B)" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fill: "#64748B", fontSize: 11 }}
                  />
                  <PolarRadiusAxis
                    tick={{ fill: "#64748B", fontSize: 9 }}
                    domain={[0, 100]}
                  />
                  <Radar
                    name="SVD"
                    dataKey="SVD"
                    stroke="#FB923C"
                    fill="#FB923C"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                  <Radar
                    name="NCF"
                    dataKey="NCF"
                    stroke="#A78BFA"
                    fill="#A78BFA"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                  <Radar
                    name="Hybride"
                    dataKey="Hybride"
                    stroke="#34D399"
                    fill="#34D399"
                    fillOpacity={0.15}
                    strokeWidth={2.5}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#94A3B8" }} />
                  <Tooltip content={<DarkTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </div>
          <Card>
            <SectionHead
              title="Distribution du dataset par catégorie"
              badge="90 753 interactions Amazon + SmartShop"
            />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={Object.entries(DIST_CATEGORIES).map(([k, v]) => ({
                  name: k,
                  count: v,
                }))}
                barSize={28}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--chart-border, #1E293B)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
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
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="count" name="Interactions" radius={[6, 6, 0, 0]}>
                  {Object.keys(DIST_CATEGORIES).map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        i === 0
                          ? "#6366F1"
                          : `hsl(${240 + i * 12},60%,${55 + i * 2}%)`
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* ── ENTRAÎNEMENT NCF ── */}
      {activeTab === "training" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <SectionHead
                title="Courbes MSE — Train vs Validation"
                badge="30 epochs NCF NeuMF"
              />
              <p className="text-[11px] text-slate-500 mb-4">
                MSE (loss) · Val plateau ep.8 → légère divergence · RMSE final =
                0.7475 [1,5]
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  data={NCF_HISTORY}
                  margin={{ top: 5, right: 15, bottom: 5, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--chart-border, #1E293B)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="ep"
                    tick={{ fill: "#64748B", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: "Époque",
                      position: "insideBottom",
                      offset: -2,
                      fill: "#64748B",
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    tick={{ fill: "#64748B", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<DarkTooltip />} />
                  <Legend
                    wrapperStyle={{
                      fontSize: 11,
                      color: "#94A3B8",
                      paddingTop: 8,
                    }}
                  />
                  <Line
                    dataKey="tl"
                    name="Train MSE"
                    stroke="#A78BFA"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    dataKey="vl"
                    name="Val MSE"
                    stroke="#6366F1"
                    strokeWidth={2.5}
                    dot={false}
                    strokeDasharray="5 3"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <SectionHead title="Courbes MAE — Train vs Validation" />
              <p className="text-[11px] text-slate-500 mb-4">
                MAE normalisé [0,1] · Best val_mae = 0.0948 (ep.29) ·
                Convergence progressive
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  data={NCF_HISTORY}
                  margin={{ top: 5, right: 15, bottom: 5, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--chart-border, #1E293B)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="ep"
                    tick={{ fill: "#64748B", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64748B", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<DarkTooltip />} />
                  <Legend
                    wrapperStyle={{
                      fontSize: 11,
                      color: "#94A3B8",
                      paddingTop: 8,
                    }}
                  />
                  <Line
                    dataKey="tm"
                    name="Train MAE"
                    stroke="#34D399"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    dataKey="vm"
                    name="Val MAE"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={false}
                    strokeDasharray="5 3"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
          <Card>
            <SectionHead
              title="Architecture NCF NeuMF"
              badge="TensorFlow / Keras"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { k: "Embedding GMF", v: "32 dimensions" },
                { k: "Embedding MLP", v: "32 dimensions" },
                { k: "Couches MLP", v: "[64, 32, 16] + Dropout 0.2" },
                { k: "Batch size", v: "512" },
                { k: "Epochs", v: "30 · Best val_mae ep.29" },
                { k: "Optimiseur", v: "Adam lr=0.001 → 0.0005" },
                { k: "SVD best params", v: "n_f=100, ep=30, lr=0.007" },
                { k: "Split", v: "72 602 train · 18 151 test" },
                { k: "Sparsité", v: "99.24% · 5 982 users" },
              ].map(({ k, v }) => (
                <div
                  key={k}
                  className="bg-white/3 border border-gognet-border-dark rounded-xl p-3"
                >
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">
                    {k}
                  </p>
                  <p className="text-[13px] font-semibold text-white mt-0.5 font-mono">
                    {v}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── RANKING @K ── */}
      {activeTab === "ranking" && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <h3 className="font-display font-bold text-[15px] text-white">
                Métriques de Ranking @K
              </h3>
              <div className="flex gap-1 ml-auto flex-wrap">
                {(["precision", "recall", "ndcg", "map"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setRankingMetric(m)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                      rankingMetric === m
                        ? "bg-gognet-indigo text-white"
                        : "bg-white/5 text-slate-400 hover:text-white"
                    }`}
                  >
                    {m === "precision"
                      ? "Precision@K"
                      : m === "recall"
                        ? "Recall@K"
                        : m === "ndcg"
                          ? "NDCG@K"
                          : "MAP@K"}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={RANKING_DATA[rankingMetric].data.map((d) => ({
                  ...d,
                  label: d.k,
                }))}
                barSize={28}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--chart-border, #1E293B)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#64748B", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0.75, 0.92]}
                  tick={{ fill: "#64748B", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v.toFixed(2)}
                />
                <Tooltip content={<DarkTooltip />} />
                <Legend
                  wrapperStyle={{
                    fontSize: 11,
                    color: "#94A3B8",
                    paddingTop: 8,
                  }}
                />
                <Bar
                  dataKey="SVD"
                  name="SVD optimisé"
                  fill="#FB923C"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="NCF"
                  name="NCF NeuMF"
                  fill="#A78BFA"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="Hybride"
                  name="Hybride ★"
                  fill="#34D399"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <SectionHead
              title="Content-Based TF-IDF v2"
              badge="Précision catégorielle"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                <p className="text-[11px] text-red-400 font-bold uppercase mb-1">
                  CB v1
                </p>
                <p className="text-3xl font-black text-red-400">57.1%</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Ancienne version
                </p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                <p className="text-[11px] text-emerald-400 font-bold uppercase mb-1">
                  CB v2
                </p>
                <p className="text-3xl font-black text-emerald-400">78.1%</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Précision catégorielle
                </p>
              </div>
              <div className="bg-gognet-indigo/10 border border-gognet-indigo/20 rounded-xl p-4 text-center">
                <p className="text-[11px] text-gognet-indigo-light font-bold uppercase mb-1">
                  Amélioration
                </p>
                <p className="text-3xl font-black text-gognet-indigo-light">
                  +21.0pp
                </p>
                <p className="text-[11px] text-slate-500 mt-1">v1 → v2</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px] text-slate-400">
              {[
                "max_features=1 500",
                "ngram_range=(1,3)",
                "Corpus enrichi catégorie ×8",
              ].map((s) => (
                <div
                  key={s}
                  className="bg-white/3 rounded-lg px-3 py-2 font-mono text-slate-400"
                >
                  {s}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── HYBRIDATION ── */}
      {activeTab === "hybrid" && (
        <div className="space-y-4">
          <Card>
            <SectionHead
              title="Paramètres hybrides actifs"
              badge="Depuis /ml/health"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              {[
                {
                  k: "alpha_svd",
                  v: hybridParams.alpha_svd,
                  desc: "Poids SVD dans CF",
                  color: "text-orange-400",
                },
                {
                  k: "alpha_cf",
                  v: hybridParams.alpha_cf,
                  desc: "Poids CF total",
                  color: "text-gognet-indigo-light",
                },
                {
                  k: "SVD effectif",
                  v: `${(hybridParams.alpha_cf * hybridParams.alpha_svd * 100).toFixed(0)}%`,
                  desc: "Part finale SVD",
                  color: "text-orange-300",
                },
                {
                  k: "NCF effectif",
                  v: `${(hybridParams.alpha_cf * (1 - hybridParams.alpha_svd) * 100).toFixed(0)}%`,
                  desc: "Part finale NCF",
                  color: "text-violet-400",
                },
              ].map((item) => (
                <div
                  key={item.k}
                  className="bg-white/3 border border-gognet-border-dark rounded-xl p-4"
                >
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">
                    {item.k}
                  </p>
                  <p className={`text-2xl font-black ${item.color}`}>
                    {typeof item.v === "number" ? item.v.toFixed(1) : item.v}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 font-bold mb-2 uppercase tracking-wide">
              Décomposition des poids finaux
            </p>
            <div className="flex h-8 rounded-xl overflow-hidden">
              <div
                className="flex items-center justify-center text-[11px] font-black text-white"
                style={{
                  width: `${(hybridParams.alpha_cf * hybridParams.alpha_svd * 100).toFixed(0)}%`,
                  background: "#FB923C",
                }}
              >
                SVD{" "}
                {(hybridParams.alpha_cf * hybridParams.alpha_svd * 100).toFixed(
                  0,
                )}
                %
              </div>
              <div
                className="flex items-center justify-center text-[11px] font-black text-white"
                style={{
                  width: `${(hybridParams.alpha_cf * (1 - hybridParams.alpha_svd) * 100).toFixed(0)}%`,
                  background: "#A78BFA",
                }}
              >
                NCF{" "}
                {(
                  hybridParams.alpha_cf *
                  (1 - hybridParams.alpha_svd) *
                  100
                ).toFixed(0)}
                %
              </div>
              <div
                className="flex-1 flex items-center justify-center text-[11px] font-black text-white"
                style={{ background: "#6366F1" }}
              >
                CB {(100 - hybridParams.alpha_cf * 100).toFixed(0)}%
              </div>
            </div>
          </Card>
          <Card>
            <SectionHead
              title="Heatmap RMSE — Grid Search alpha_svd × alpha_cf"
              badge="Cellule optimale en vert — 2 000 interactions"
            />
            <div className="overflow-x-auto rounded-xl">
              <table className="text-[12px] min-w-[360px]">
                <thead>
                  <tr>
                    <th className="py-2.5 px-3 text-left text-slate-500 font-semibold text-[11px]">
                      α_svd \\ α_cf
                    </th>
                    {HEATMAP[0].values.map((v) => (
                      <th
                        key={v.cf}
                        className="py-2.5 px-3 text-center text-slate-500 font-semibold text-[11px]"
                      >
                        {v.cf}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HEATMAP.map((row) => (
                    <tr key={row.alpha_svd}>
                      <td className="py-2.5 px-3 font-semibold text-slate-400">
                        {row.alpha_svd}
                      </td>
                      {row.values.map((cell) => (
                        <td
                          key={cell.cf}
                          className={`py-2.5 px-3 text-center font-mono font-bold rounded transition-all ${
                            cell.best
                              ? "bg-emerald-500/20 text-emerald-400 outline outline-1 outline-emerald-500/50"
                              : "text-slate-400"
                          }`}
                        >
                          {cell.rmse.toFixed(4)}
                          {cell.best && (
                            <span className="ml-1 text-[9px]">★</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-600 mt-2">
              Optimum : α_svd=0.3, α_cf=0.6 → RMSE=0.5820 (évaluation sur 2 000
              interactions)
            </p>
          </Card>
        </div>
      )}

      {/* ── DIAGNOSTIC ── */}
      {activeTab === "diagnostic" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                k: "Statut modèle",
                v: recLoaded ? "✅ Chargé" : "❌ Non chargé",
              },
              {
                k: "Interactions totales",
                v: mlHealth?.rec_sys?.n_users
                  ? String(mlHealth.rec_sys.n_users)
                  : "90 753",
              },
              {
                k: "Produits encodés",
                v: mlHealth?.rec_sys?.catalog?.n_products_kaggle
                  ? String(mlHealth.rec_sys.catalog.n_products_kaggle)
                  : "2 000",
              },
              {
                k: "Utilisateurs enc.",
                v: mlHealth?.rec_sys?.catalog?.n_users_encoded
                  ? String(mlHealth.rec_sys.catalog.n_users_encoded)
                  : "5 982",
              },
              {
                k: "SmartShop inter.",
                v: mlHealth?.rec_sys?.real_db?.interactions_real
                  ? String(mlHealth.rec_sys.real_db.interactions_real)
                  : "16 931",
              },
              {
                k: "Version modèle",
                v: mlHealth?.rec_sys?.version ?? "v2-final",
              },
            ].map(({ k, v }) => (
              <div
                key={k}
                className="bg-gognet-navy border border-gognet-border-dark rounded-xl p-4"
              >
                <p className="text-[10px] text-slate-500 uppercase font-bold">
                  {k}
                </p>
                <p className="text-[14px] font-bold text-white mt-0.5">{v}</p>
              </div>
            ))}
          </div>
          {Object.keys(recFiles).length > 0 && (
            <Card>
              <SectionHead title="Fichiers modèles" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(recFiles).map(([f, ok]) => (
                  <div
                    key={f}
                    className={`flex items-center gap-2.5 rounded-xl px-4 py-3 border text-[12px] ${
                      ok
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-red-500/30 bg-red-500/5"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 ${ok ? "bg-emerald-500" : "bg-red-500"}`}
                    >
                      {ok ? "✓" : "✗"}
                    </span>
                    <span
                      className={`font-medium font-mono ${ok ? "text-emerald-300" : "text-red-300"}`}
                    >
                      {f}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <div className="text-center text-[11px] text-slate-600 py-2 font-mono">
        RecSys ML · Sprint S3 · GoGNet SmartShop · SVD(n_f=100,ep=30,lr=0.007) +
        NCF(32dim,30ep,val_mae=0.0948) + CB-TF-IDF(78.1%)
      </div>
    </div>
  );
}
