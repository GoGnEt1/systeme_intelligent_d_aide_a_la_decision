// src/pages/admin/OrdersTab.tsx
import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";
import Spinner from "../../components/common/Spinner";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import {
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
  FiCalendar,
  FiAlertTriangle,
  FiTruck,
  FiPackage,
  FiUser,
  FiClock,
  FiCheck,
  FiX,
  FiAlertCircle,
  FiMapPin,
  FiPrinter,
} from "react-icons/fi";
import type { Order, OrderStatusHistory } from "../../types";
import { buildImageUrl } from "../../store/slices/images";
import OrderReceipt from "../../components/order/OrderReceipt";
import { useAdminTheme } from "./AdminDashboards";

// ─────────────────────────────────────────────────────────────
//  Constantes
// ─────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

// Status color tokens — hex values work on both dark and light themes
const STATUS_COLORS: Record<
  string,
  { bg: string; text: string; dot: string; border: string }
> = {
  PENDING: {
    bg: "#78350F18",
    text: "#F59E0B",
    dot: "#F59E0B",
    border: "#F59E0B44",
  },
  CONFIRMED: {
    bg: "#1E3A5F18",
    text: "#3B82F6",
    dot: "#3B82F6",
    border: "#3B82F644",
  },
  PROCESSING: {
    bg: "#4C1D9518",
    text: "#8B5CF6",
    dot: "#8B5CF6",
    border: "#8B5CF644",
  },
  SHIPPED: {
    bg: "#1E1B4B18",
    text: "#6366F1",
    dot: "#6366F1",
    border: "#6366F144",
  },
  DELIVERED: {
    bg: "#06522018",
    text: "#10B981",
    dot: "#10B981",
    border: "#10B98144",
  },
  CANCELLED: {
    bg: "#7F1D1D18",
    text: "#EF4444",
    dot: "#EF4444",
    border: "#EF444444",
  },
  REFUNDED: {
    bg: "#1E293B18",
    text: "#64748B",
    dot: "#64748B",
    border: "#64748B44",
  },
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  PROCESSING: "En préparation",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

const PAYMENT_LABELS: Record<string, string> = {
  COD: "Livraison",
  MOBILE: "i-Dinar",
  CARD: "Carte bancaire",
};

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

function tomorrow(): string {
  return new Date(Date.now() + 86400000).toISOString().split("T")[0];
}
function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
// Vérifie si la date de livraison est dépassée (= client absent)
function isDatePast(d: string | null | undefined): boolean {
  if (!d) return false;
  return new Date(d) < new Date(new Date().toDateString()); // compare jours
}

// ─────────────────────────────────────────────────────────────
//  Sous-composant : Timeline historique
// ─────────────────────────────────────────────────────────────

function StatusTimeline({ history }: { history: OrderStatusHistory[] }) {
  const T = useAdminTheme();
  if (!history?.length)
    return (
      <p className="text-[12px] text-gray-400 italic">
        Aucun changement de statut enregistré.
      </p>
    );
  return (
    <div className="relative pl-4">
      <div
        style={{
          position: "absolute",
          left: 6,
          top: 0,
          bottom: 0,
          width: 1,
          background: T.border,
        }}
      />
      {[...history].reverse().map((h, i) => (
        <div key={h.id} className="relative mb-3 last:mb-0">
          <div
            style={{
              position: "absolute",
              left: -11,
              width: 10,
              height: 10,
              borderRadius: "50%",
              border: `2px solid ${T.card}`,
              background: i === 0 ? "#FF9900" : T.muted,
            }}
          />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                {STATUS_LABELS[h.old_status] || h.old_status}
                <span
                  style={{ color: T.muted, fontWeight: 400, margin: "0 4px" }}
                >
                  →
                </span>
                {STATUS_LABELS[h.new_status] || h.new_status}
              </p>
              <p style={{ fontSize: 11, color: T.muted }}>
                par{" "}
                <strong style={{ color: T.text }}>{h.changed_by_name}</strong>
              </p>
              {h.note && (
                <p
                  style={{
                    fontSize: 11,
                    color: T.muted,
                    fontStyle: "italic",
                    marginTop: 2,
                  }}
                >
                  "{h.note}"
                </p>
              )}
            </div>
            <span
              style={{
                fontSize: 11,
                color: T.muted,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {new Date(h.changed_at).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Sous-composant : Gestion livraison (date + absences)
//
//  Logique d'affichage :
//    attempts = 0 → DeliveryDatePicker uniquement
//    attempts = 1 ET date passée → MissedDeliveryPanel + input date > delivery_date
//    attempts > 1 → Badge "Abandon définitif", aucun panneau
// ─────────────────────────────────────────────────────────────

interface DeliveryPanelProps {
  order: Order;
  onOrderUpdate: (updated: Partial<Order> & { id: number }) => void;
}

function DeliveryPanel({ order, onOrderUpdate }: DeliveryPanelProps) {
  const attempts = order.delivery_attempts ?? 0;
  const noMore = order.no_more_delivery ?? false;
  const datePast = isDatePast(order.delivery_date);

  const [newDate, setNewDate] = useState("");
  const [loadingDate, setLoadingDate] = useState(false);
  const [loadingMissed, setLoadingMissed] = useState(false);

  // Réinitialiser le champ date quand la commande change
  useEffect(() => {
    setNewDate("");
  }, [order.id]);

  // ── Sauvegarder la date de livraison ──
  const handleSaveDate = async () => {
    if (!newDate) return;
    setLoadingDate(true);
    try {
      const { data } = await api.patch(`/orders/${order.id}/delivery-date/`, {
        delivery_date: newDate,
      });
      // delivery-date retourne { order_number, delivery_date }
      // On met à jour localement delivery_date sur l'order
      onOrderUpdate({ id: order.id, delivery_date: data.delivery_date });
      setNewDate("");
      toast.success("Date de livraison enregistrée.");
    } catch {
      toast.error("Erreur lors de l'enregistrement de la date.");
    } finally {
      setLoadingDate(false);
    }
  };

  // ── Enregistrer une absence ──
  const handleMissed = async () => {
    if (attempts < 1 && !newDate) {
      toast.error("Choisissez d'abord une nouvelle date de re-livraison.");
      return;
    }
    setLoadingMissed(true);
    try {
      const { data } = await api.post(`/orders/${order.id}/missed-delivery/`, {
        ...(newDate ? { new_delivery_date: newDate } : {}),
      });
      onOrderUpdate(data);
      setNewDate("");
      if (data.no_more_delivery) {
        toast("⛔ 2ème absence — livraison définitivement abandonnée.", {
          icon: "⛔",
        });
      } else {
        toast.success(
          "1ère absence enregistrée — nouvelle date transmise au client.",
        );
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(
        e.response?.data?.error || "Erreur lors de l'enregistrement.",
      );
    } finally {
      setLoadingMissed(false);
    }
  };

  // ── Visible seulement pour SHIPPED et PROCESSING ──
  if (!["SHIPPED", "PROCESSING"].includes(order.status)) return null;

  // ── CAS 3 : 2 absences épuisées ──
  if (noMore) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <FiAlertCircle size={14} className="text-red-600" />
          </div>
          <p className="text-[12px] font-semibold text-red-700">
            Livraison abandonnée — 2 absences
          </p>
        </div>
        <p className="text-[12px] text-red-600 ml-9">
          Cette commande ne peut plus être expédiée. Le client a été notifié.
        </p>
      </div>
    );
  }

  // ── CAS 2 : 1ère absence déjà enregistrée (ou date passée) ──
  if (attempts === 1 || (attempts === 0 && datePast && order.delivery_date)) {
    // Date min pour la nouvelle tentative = jour d'après la date actuelle
    const minDate = order.delivery_date
      ? new Date(new Date(order.delivery_date).getTime() + 86400000)
          .toISOString()
          .split("T")[0]
      : tomorrow();

    return (
      <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-3">
        {/* Statut absence */}
        <div className="flex items-start gap-2">
          <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <FiAlertTriangle size={13} className="text-orange-600" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-orange-700">
              {attempts === 1
                ? "1ère absence enregistrée"
                : "Client absent à la livraison"}
            </p>
            <p className="text-[11px] text-orange-600">
              Date initiale : <strong>{formatDate(order.delivery_date)}</strong>
              {" — "}Tentative {Math.max(attempts, 1)}/2
            </p>
          </div>
        </div>

        {/* Nouvelle date obligatoire */}
        <div>
          <label className="block text-[12px] font-medium text-gray-700 mb-1">
            Nouvelle date de livraison <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={newDate}
              min={minDate}
              title="Choisissez une nouvelle date de livraison"
              onChange={(e) => setNewDate(e.target.value)}
              className="flex-1 border border-orange-300 rounded-lg px-3 py-1.5 text-[12px]
                         focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Doit être après le {formatDate(order.delivery_date)}
          </p>
        </div>

        {/* Avertissement 2ème absence */}
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[11px] text-red-700 flex items-start gap-1.5">
          <FiAlertCircle size={12} className="flex-shrink-0 mt-0.5" />
          <span>
            En confirmant l'absence avec une nouvelle date, le statut repassera
            en préparation.
            <br />
            <strong>
              Si la 2ème date est aussi manquée, la livraison sera
              définitivement abandonnée.
            </strong>
          </span>
        </div>

        <button
          onClick={handleMissed}
          disabled={loadingMissed || !newDate}
          className="w-full flex items-center justify-center gap-2 py-2 px-4
                     bg-orange-500 hover:bg-orange-600 disabled:opacity-50
                     text-white text-[12px] font-semibold rounded-lg transition-colors"
        >
          {loadingMissed ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <FiAlertTriangle size={13} />
          )}
          Enregistrer la 1ère absence + planifier re-livraison
        </button>
      </div>
    );
  }

  // ── CAS 1 : Aucune absence encore (attempts = 0) ──
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
          <FiCalendar size={13} className="text-blue-500" />
        </div>
        <p className="text-[12px] font-medium text-gray-700">
          {order.delivery_date ? (
            <>
              Date prévue :{" "}
              <strong className="text-blue-700">
                {formatDate(order.delivery_date)}
              </strong>
            </>
          ) : (
            "Planifier la date de livraison"
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 pl-9">
        <input
          type="date"
          value={newDate}
          title="Date de livraison"
          min={tomorrow()}
          onChange={(e) => setNewDate(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-[12px]
                     focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        />
        <button
          onClick={handleSaveDate}
          disabled={loadingDate || !newDate}
          className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50
                     text-white text-[12px] font-semibold rounded-lg transition-colors
                     flex items-center gap-1.5 whitespace-nowrap"
        >
          {loadingDate ? (
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <FiCheck size={12} />
          )}
          Enregistrer
        </button>
      </div>

      {order.delivery_date && (
        <p className="text-[11px] text-gray-400 pl-9">
          Modifier si nécessaire. Laisser vide pour conserver la date actuelle.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Composant principal
// ─────────────────────────────────────────────────────────────

export default function OrdersTab() {
  const T = useAdminTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [notes, setNotes] = useState<Record<number, string>>({});

  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  // ── Nouveaux états : recherche + pagination + compteurs globaux ──
  const [searchOrder, setSearchOrder] = useState("");
  const [statusFilter2, setStatusFilter2] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const PAGE_SIZE = 20;

  // ── loadOrders : récupère les commandes + status_counts globaux ──
  const loadOrders = useCallback((pg = 1, q = "", st = "") => {
    setLoading(true);
    const params = new URLSearchParams({
      ordering: "-created_at",
      all: "true",
      page: String(pg),
      page_size: String(PAGE_SIZE),
    });
    if (q.trim()) params.set("search", q.trim());
    if (st) params.set("status", st);
    api
      .get(`/orders/?${params}`)
      .then((r) => {
        const d = r.data;
        console.log("Orders: ", d);

        setOrders(d.results ?? d);
        setTotalCount(d.count ?? (d.results ?? d).length);
        setTotalPages(
          Math.ceil((d.count ?? (d.results ?? d).length) / PAGE_SIZE) || 1,
        );
        // ← status_counts renvoyé par le backend : compteurs GLOBAUX
        if (d.status_counts) {
          setStatusCounts(d.status_counts);
        }
      })
      .catch(() => toast.error("Erreur lors du chargement des commandes."))
      .finally(() => setLoading(false));
  }, []);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    loadOrders(newPage, searchOrder, statusFilter2);
  };

  // Debounce sur la recherche texte
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      loadOrders(1, searchOrder, statusFilter2);
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchOrder, statusFilter2, loadOrders]);

  useEffect(() => {
    loadOrders(1);
  }, [loadOrders]);

  // Mise à jour locale d'un order (évite un re-fetch complet)
  // Si le statut a changé, on recalcule aussi statusCounts optimistement
  const patchLocalOrder = (patch: Partial<Order> & { id: number }) => {
    setOrders((prev) => {
      const updated = prev.map((o) =>
        o.id === patch.id ? { ...o, ...patch } : o,
      );

      // Si le statut a changé, mettre à jour les compteurs globaux
      if (patch.status) {
        const oldOrder = prev.find((o) => o.id === patch.id);
        if (oldOrder && oldOrder.status !== patch.status) {
          setStatusCounts((counts) => ({
            ...counts,
            [oldOrder.status]: Math.max(0, (counts[oldOrder.status] ?? 0) - 1),
            [patch.status!]: (counts[patch.status!] ?? 0) + 1,
          }));
        }
      }
      return updated;
    });
  };

  const updateStatus = async (order: Order, newStatus: string) => {
    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (order.no_more_delivery && newStatus === "SHIPPED") {
      toast.error(
        "Impossible : ce client a épuisé ses tentatives de livraison.",
      );
      return;
    }
    if (!allowed.includes(newStatus)) {
      toast.error(
        `Transition interdite : ${STATUS_LABELS[order.status]} → ${STATUS_LABELS[newStatus]}`,
      );
      return;
    }
    setUpdatingId(order.id);
    try {
      const { data } = await api.patch(`/orders/${order.id}/status/`, {
        status: newStatus,
        note: notes[order.id] || "",
      });
      patchLocalOrder(data);
      setNotes((prev) => ({ ...prev, [order.id]: "" }));
      // si order.status = "DELIVERED", on met à jour le status du paiement à "COMPLETED"
      if (order.status === "DELIVERED") {
        await api.patch(`/payments/${order.id}/update/`, {
          status: "COMPLETED",
        });
      }

      toast.success(`Statut → ${STATUS_LABELS[newStatus]}`);
    } catch (err: unknown) {
      const e = err as {
        response?: {
          data?: { error?: string; transitions_valides?: string[] };
        };
      };
      toast.error(e.response?.data?.error || "Erreur lors de la mise à jour.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtre local sur la page courante (pour le highlight visuel uniquement)
  // Le vrai filtre se fait côté API via statusFilter2
  const filtered =
    filterStatus === "ALL"
      ? orders
      : orders.filter((o) => o.status === filterStatus);

  // ← Compteurs globaux issus de status_counts (pas juste la page courante)
  const stats = Object.entries(STATUS_LABELS)
    .map(([key, label]) => ({
      key,
      label,
      count: statusCounts[key] ?? 0,
    }))
    .filter((s) => s.count > 0);

  return (
    <div
      className="space-y-4 admin-tab-root"
      style={
        {
          padding: "28px 20px",
          fontFamily: "'Inter', -apple-system, sans-serif",
          // background: T.bg,
          minHeight: "100vh",
          color: T.text,
          "--tab-text": T.text,
          "--tab-muted": T.muted,
          "--tab-bg": T.bg,
          "--tab-card": T.card,
          "--tab-border": T.border,
          "--tab-active": T.active,
          "--tab-input": T.inputBg,
        } as React.CSSProperties
      }
    >
      {/* Dynamic overrides for tailwind classes in light/dark mode */}
      <style>{`
        /* Text colors */
        .admin-tab-root .text-gray-800, .admin-tab-root .text-gray-700 { color: ${T.text} !important; }
        .admin-tab-root .text-gray-600, .admin-tab-root .text-gray-500 { color: ${T.muted} !important; }
        .admin-tab-root .text-gray-400, .admin-tab-root .text-gray-300 { color: ${T.muted}99 !important; }
        .admin-tab-root .text-blue-600 { color: #60A5FA !important; }
        .admin-tab-root .text-blue-700 { color: #3B82F6 !important; }
        .admin-tab-root .text-blue-500 { color: #60A5FA !important; }
        /* Backgrounds */
        .admin-tab-root .bg-white { background: ${T.card} !important; }
        .admin-tab-root .bg-gray-50 { background: ${T.active} !important; }
        .admin-tab-root .bg-gray-100 { background: ${T.active} !important; }
        .admin-tab-root .bg-red-50 { background: ${T.isDark ? "#7F1D1D22" : "#FEF2F2"} !important; }
        .admin-tab-root .bg-orange-50 { background: ${T.isDark ? "#78350F22" : "#FFF7ED"} !important; }
        .admin-tab-root .bg-blue-50 { background: ${T.isDark ? "#1E3A5F22" : "#EFF6FF"} !important; }
        .admin-tab-root .bg-red-100 { background: ${T.isDark ? "#7F1D1D33" : "#FEE2E2"} !important; }
        .admin-tab-root .bg-orange-100 { background: ${T.isDark ? "#78350F33" : "#FFEDD5"} !important; }
        .admin-tab-root .bg-blue-100 { background: ${T.isDark ? "#1E3A5F33" : "#DBEAFE"} !important; }
        /* Borders */
        .admin-tab-root .border-gray-200, .admin-tab-root .border-gray-300 { border-color: ${T.border} !important; }
        .admin-tab-root .border-red-200 { border-color: ${T.isDark ? "#EF444444" : "#FCA5A5"} !important; }
        .admin-tab-root .border-orange-200 { border-color: ${T.isDark ? "#F59E0B44" : "#FCD34D"} !important; }
        .admin-tab-root .border-blue-100 { border-color: ${T.isDark ? "#3B82F633" : "#DBEAFE"} !important; }
        .admin-tab-root .divide-gray-200 > * + * { border-color: ${T.border} !important; }
        /* Text in alerts */
        .admin-tab-root .text-red-700 { color: ${T.isDark ? "#FCA5A5" : "#B91C1C"} !important; }
        .admin-tab-root .text-orange-800 { color: ${T.isDark ? "#FCD34D" : "#92400E"} !important; }
        .admin-tab-root .text-orange-700 { color: ${T.isDark ? "#FCD34D" : "#B45309"} !important; }
        .admin-tab-root .text-blue-700 { color: ${T.isDark ? "#93C5FD" : "#1D4ED8"} !important; }
        /* Inputs */
        .admin-tab-root input, .admin-tab-root textarea, .admin-tab-root select {
          background: ${T.inputBg} !important;
          color: ${T.text} !important;
          border-color: ${T.border} !important;
        }
      `}</style>
      {/* ── Titre ───────────────────────────────────── */}
      <div style={{ marginBottom: 4 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: T.text, margin: 0 }}>
          Gestion des commandes
        </h2>
        <p style={{ fontSize: 12, color: T.muted, margin: "4px 0 0" }}>
          Suivi, statuts et livraisons
        </p>
      </div>

      {/* ── Barre de recherche ───────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center mb-1">
        <div className="relative flex-1 min-w-[220px]">
          <input
            type="text"
            placeholder="Référence, client, email, téléphone…"
            value={searchOrder}
            onChange={(e) => {
              setSearchOrder(e.target.value);
              setPage(1);
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: T.inputBg,
              color: T.text,
              border: `1px solid ${T.border}`,
            }}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] outline-none"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50 text-[14px]">
            🔍
          </span>
        </div>
        <span style={{ color: T.muted }} className="text-[12px]">
          {totalCount} commande{totalCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Barre de filtres par statut ──────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Bouton "Toutes" — affiche le total global */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setStatusFilter2("");
            setFilterStatus("ALL");
            setPage(1);
            loadOrders(1, searchOrder, "");
          }}
          style={{
            fontSize: 12,
            padding: "6px 14px",
            borderRadius: 20,
            fontWeight: 600,
            background: filterStatus === "ALL" ? T.accent : T.active,
            color: filterStatus === "ALL" ? "white" : T.muted,
            border: `1px solid ${filterStatus === "ALL" ? T.accent : T.border}`,
            cursor: "pointer",
          }}
        >
          Toutes ({totalCount})
        </button>

        {/* Un bouton par statut avec compteur global ← status_counts */}
        {stats.map((s) => (
          <button
            key={s.key}
            onClick={(e) => {
              e.stopPropagation();
              setStatusFilter2(s.key);
              setFilterStatus(s.key);
              setPage(1);
              loadOrders(1, searchOrder, s.key);
            }}
            style={{
              fontSize: 12,
              padding: "6px 14px",
              borderRadius: 20,
              fontWeight: 600,
              background: filterStatus === s.key ? T.accent : T.active,
              color: filterStatus === s.key ? "white" : T.muted,
              border: `1px solid ${filterStatus === s.key ? T.accent : T.border}`,
              cursor: "pointer",
            }}
          >
            {s.label} ({s.count})
          </button>
        ))}

        {/* Bouton actualiser */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            loadOrders(page, searchOrder, statusFilter2);
          }}
          style={{
            marginLeft: "auto",
            padding: "6px 8px",
            background: "none",
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            cursor: "pointer",
            color: T.muted,
          }}
          title="Actualiser"
        >
          <FiRefreshCw size={14} />
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: T.isDark ? "none" : "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <div className="overflow-x-auto">
            <table
              style={{
                width: "100%",
                fontSize: 13,
                minWidth: 900,
                borderCollapse: "collapse",
              }}
            >
              <thead
                style={{
                  background: T.active,
                  borderBottom: `2px solid ${T.border}`,
                }}
              >
                <tr style={{ height: 48 }}>
                  {[
                    "N° commande",
                    "Client",
                    "Date de livraison",
                    "Paiement",
                    "Total",
                    "Statut actuel",
                    "Actions",
                    "Détail",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 700,
                        color: T.muted,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-gray-400">
                      <FiPackage
                        size={32}
                        className="mx-auto mb-2 opacity-30"
                      />
                      <p>Aucune commande trouvée</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => {
                    const isExpanded = expandedId === o.id;
                    const attempts = o.delivery_attempts ?? 0;
                    const noMore = o.no_more_delivery ?? false;
                    const allowedNext = (
                      VALID_TRANSITIONS[o.status] ?? []
                    ).filter((s) => !(s === "SHIPPED" && noMore));
                    // const deliveryAlert  = attempts > 0 && !noMore;
                    const statusColors =
                      STATUS_COLORS[o.status] ?? STATUS_COLORS.PENDING;

                    return (
                      <>
                        {/* ── Ligne principale ── */}
                        <tr
                          key={o.id}
                          onClick={() =>
                            setExpandedId(isExpanded ? null : o.id)
                          }
                          style={{
                            background: isExpanded
                              ? T.isDark
                                ? "#1E3A5F22"
                                : "#EFF6FF"
                              : noMore
                                ? T.isDark
                                  ? "#7F1D1D22"
                                  : "#FEF2F2"
                                : "transparent",
                            borderBottom: `1px solid ${T.border}`,
                            cursor: "pointer",
                            transition: "background 0.12s",
                          }}
                        >
                          {/* N° commande */}
                          <td className="px-4 py-3">
                            <p className="font-mono font-semibold text-[12px] text-blue-600">
                              {o.order_number}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {new Date(o.created_at).toLocaleDateString(
                                "fr-FR",
                              )}
                            </p>
                          </td>

                          {/* Client */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-7 h-7 rounded-full bg-gray-100 flex items-center
                                            justify-center flex-shrink-0 text-gray-500"
                              >
                                <FiUser size={12} />
                              </div>
                              <div>
                                <p className="text-[12px] font-medium text-gray-800 truncate max-w-[120px]">
                                  {o.shipping_full_name || "—"}
                                </p>
                                <p className="text-[11px] text-gray-400">
                                  {o.shipping_phone}
                                </p>
                              </div>
                            </div>
                            {/* Badge absence */}
                            {attempts > 0 && (
                              <span
                                className={`inline-flex items-center gap-1 mt-1 text-[10px]
                              px-2 py-0.5 rounded-full font-semibold
                              ${
                                noMore
                                  ? "bg-red-100 text-red-700"
                                  : "bg-orange-100 text-orange-700"
                              }`}
                              >
                                <FiAlertTriangle size={9} />
                                {noMore
                                  ? "Abandon définitif"
                                  : `Absence ${attempts}/2`}
                              </span>
                            )}
                          </td>

                          {/* Date livraison */}
                          <td className="px-4 py-3">
                            {o.delivery_date ? (
                              <div className="flex items-center gap-1.5">
                                <FiCalendar
                                  size={12}
                                  className={
                                    isDatePast(o.delivery_date)
                                      ? "text-red-400"
                                      : "text-blue-500"
                                  }
                                />
                                <div>
                                  <p
                                    className={`text-[12px] font-medium
                                  ${isDatePast(o.delivery_date) ? "text-red-600" : "text-gray-700"}`}
                                  >
                                    {formatDate(o.delivery_date)}
                                  </p>
                                  {isDatePast(o.delivery_date) &&
                                    attempts === 0 && (
                                      <p className="text-[10px] text-red-500">
                                        Date dépassée
                                      </p>
                                    )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[12px] text-gray-300 italic">
                                Non planifiée
                              </span>
                            )}
                          </td>

                          {/* Paiement */}
                          <td className="px-4 py-3">
                            {o.payment ? (
                              <>
                                <p className="text-[12px] text-gray-700 font-medium">
                                  {PAYMENT_LABELS[o.payment.method] ||
                                    o.payment.method_display}
                                </p>
                                <p
                                  className={`text-[11px] font-medium
                                ${
                                  o.payment.status === "COMPLETED"
                                    ? "text-emerald-600"
                                    : o.payment.status === "FAILED"
                                      ? "text-red-500"
                                      : "text-amber-600"
                                }`}
                                >
                                  {o.payment.status_display}
                                </p>
                              </>
                            ) : (
                              <span className="text-[12px] text-gray-300">
                                —
                              </span>
                            )}
                          </td>

                          {/* Total */}
                          <td className="px-4 py-3">
                            <p className="font-bold text-gray-800">
                              {parseFloat(String(o.total_amount)).toFixed(2)} DT
                            </p>
                          </td>

                          {/* Statut */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <div
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  flexShrink: 0,
                                  background: statusColors.dot,
                                }}
                              />
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: 20,
                                  background: statusColors.bg,
                                  color: statusColors.text,
                                  border: `1px solid ${statusColors.border}`,
                                }}
                              >
                                {STATUS_LABELS[o.status]}
                              </span>
                            </div>
                          </td>

                          {/* Actions — transitions */}
                          <td className="px-4 py-3 min-w-[200px]">
                            {updatingId === o.id ? (
                              <Spinner size="sm" />
                            ) : allowedNext.length === 0 ? (
                              <span className="text-[11px] text-gray-400 italic">
                                {noMore
                                  ? "Traitement manuel requis"
                                  : "Statut final"}
                              </span>
                            ) : (
                              <div className="space-y-1.5">
                                <input
                                  type="text"
                                  placeholder="Note optionnelle..."
                                  value={notes[o.id] || ""}
                                  onChange={(e) =>
                                    setNotes((p) => ({
                                      ...p,
                                      [o.id]: e.target.value,
                                    }))
                                  }
                                  className="w-full text-[11px] border border-gray-200 rounded-lg
                                           px-2.5 py-1 focus:outline-none focus:ring-1
                                           focus:ring-gognet-orange bg-white"
                                />
                                <div className="flex flex-wrap gap-1">
                                  {allowedNext.map((next) => (
                                    <button
                                      key={next}
                                      onClick={() => updateStatus(o, next)}
                                      className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1
                                      rounded-lg font-semibold border transition-colors
                                      ${
                                        next === "CANCELLED"
                                          ? "border-red-200 text-red-600 hover:bg-red-50"
                                          : next === "DELIVERED"
                                            ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                            : "border-blue-200 text-blue-700 hover:bg-blue-50"
                                      }`}
                                    >
                                      {next === "CANCELLED" ? (
                                        <FiX size={10} />
                                      ) : next === "DELIVERED" ? (
                                        <FiCheck size={10} />
                                      ) : (
                                        <FiTruck size={10} />
                                      )}
                                      {STATUS_LABELS[next]}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Toggle détail */}
                          <td className="px-3 py-3">
                            <button
                              onClick={() =>
                                setExpandedId(isExpanded ? null : o.id)
                              }
                              className={`p-1.5 rounded-lg transition-colors
                              ${
                                isExpanded
                                  ? "bg-blue-100 text-blue-600"
                                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                              }`}
                              title="Voir les détails"
                            >
                              {isExpanded ? (
                                <FiChevronUp size={15} />
                              ) : (
                                <FiChevronDown size={15} />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* ── Ligne détail expandable ── */}
                        {isExpanded && (
                          <tr
                            key={`${o.id}-detail`}
                            className="bg-blue-50/30 border-b border-blue-100"
                          >
                            <td colSpan={8} className="px-5 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Col 1 — Articles + totaux */}
                                <div className="space-y-3">
                                  <h4
                                    className="text-[12px] font-bold text-gray-600 uppercase tracking-wide
                                               flex items-center gap-1.5"
                                  >
                                    <FiPackage size={12} /> Articles (
                                    {o.items.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {o.items.map((item) => {
                                      const price = parseFloat(
                                        String(item.unit_price),
                                      );
                                      const thumb =
                                        buildImageUrl(item.product_image) ??
                                        null;
                                      return (
                                        <div
                                          key={item.id}
                                          className="flex items-center gap-2 bg-white rounded-lg p-2 border"
                                        >
                                          <div
                                            className="w-9 h-9 rounded-lg border bg-gray-50 flex items-center
                                                        justify-center flex-shrink-0 overflow-hidden"
                                          >
                                            {thumb ? (
                                              <img
                                                src={thumb}
                                                alt={item.product_name}
                                                className="w-full h-full object-contain"
                                              />
                                            ) : (
                                              <FiPackage
                                                size={14}
                                                className="text-gray-300"
                                              />
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <Link
                                              className="text-[12px] font-medium truncate hover:underline"
                                              to={`/products/${item.product_slug}`}
                                              // className="product-card block group relative lg:w-70"
                                            >
                                              {item.product_name.slice(0, 25)}
                                            </Link>
                                            {/* </p> */}
                                            <p className="text-[11px] text-gray-400">
                                              {item.quantity} ×{" "}
                                              {price.toFixed(2)} DT
                                            </p>
                                          </div>
                                          <p className="text-[12px] font-bold text-gray-700 flex-shrink-0">
                                            {(price * item.quantity).toFixed(2)}{" "}
                                            DT
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {/* Totaux */}
                                  <div className="bg-white rounded-lg border p-3 text-[12px] space-y-1">
                                    {[
                                      [
                                        "Sous-total",
                                        `${parseFloat(String(o.subtotal)).toFixed(2)} DT`,
                                      ],
                                      [
                                        "Livraison",
                                        parseFloat(String(o.shipping_cost)) ===
                                        0
                                          ? "Gratuite"
                                          : `${parseFloat(String(o.shipping_cost)).toFixed(2)} DT`,
                                      ],
                                      [
                                        "Timbre",
                                        `${parseFloat(String(o.tva_timbre || 1)).toFixed(2)} DT`,
                                      ],
                                    ].map(([k, v]) => (
                                      <div
                                        key={k}
                                        className="flex justify-between text-gray-500"
                                      >
                                        <span>{k}</span>
                                        <span>{v}</span>
                                      </div>
                                    ))}
                                    <div className="flex justify-between font-bold text-[13px] border-t pt-1.5 mt-1">
                                      <span>Total TTC</span>
                                      <span className="text-red-600">
                                        {parseFloat(
                                          String(o.total_amount),
                                        ).toFixed(2)}{" "}
                                        DT
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Col 2 — Adresse + paiement + livraison */}
                                <div className="space-y-3">
                                  {/* Adresse */}
                                  {o.shipping_full_name && (
                                    <div>
                                      <h4
                                        className="text-[12px] font-bold text-gray-600 uppercase tracking-wide
                                                   flex items-center gap-1.5 mb-2"
                                      >
                                        <FiMapPin size={12} /> Adresse de
                                        livraison
                                      </h4>
                                      <div className="bg-white rounded-lg border p-3 text-[12px] text-gray-600 space-y-0.5">
                                        <p className="font-semibold text-gray-800">
                                          {o.shipping_full_name}
                                        </p>
                                        <p>{o.shipping_phone}</p>
                                        <p>{o.shipping_address_line}</p>
                                        <p>
                                          {o.shipping_postal_code}{" "}
                                          {o.shipping_city},{" "}
                                          {o.shipping_country}
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Paiement */}
                                  {o.payment && (
                                    <div>
                                      <h4 className="text-[12px] font-bold text-gray-600 uppercase tracking-wide mb-2">
                                        Paiement
                                      </h4>
                                      <div className="bg-white rounded-lg border p-3 text-[12px] space-y-1">
                                        <div className="flex justify-between">
                                          <span className="text-gray-500">
                                            Mode
                                          </span>
                                          <span className="font-medium">
                                            {o.payment.method_display}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-500">
                                            Statut
                                          </span>
                                          <span
                                            className={`font-semibold
                                          ${
                                            o.payment.status === "COMPLETED"
                                              ? "text-emerald-600"
                                              : o.payment.status === "FAILED"
                                                ? "text-red-500"
                                                : "text-amber-600"
                                          }`}
                                          >
                                            {o.payment.status_display}
                                          </span>
                                        </div>
                                        {o.payment.idinar_number && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-500">
                                              i-Dinar
                                            </span>
                                            <span className="font-mono text-[11px]">
                                              ···
                                              {o.payment.idinar_number.slice(
                                                -4,
                                              )}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Gestion livraison */}
                                  <div>
                                    <h4
                                      className="text-[12px] font-bold text-gray-600 uppercase tracking-wide
                                                 flex items-center gap-1.5 mb-2"
                                    >
                                      <FiTruck size={12} /> Gestion livraison
                                    </h4>
                                    <DeliveryPanel
                                      order={o}
                                      onOrderUpdate={patchLocalOrder}
                                    />
                                  </div>
                                </div>

                                {/* Col 3 — Historique statuts */}
                                <div>
                                  <h4
                                    className="text-[12px] font-bold text-gray-600 uppercase tracking-wide
                                               flex items-center gap-1.5 mb-2"
                                  >
                                    <FiClock size={12} /> Historique des statuts
                                  </h4>
                                  <div className="bg-white rounded-lg border p-3">
                                    <StatusTimeline
                                      history={o.status_history ?? []}
                                    />
                                  </div>
                                  {o.notes && (
                                    <div className="bg-white rounded-lg border p-3 mt-2 text-[12px]">
                                      <p className="font-medium text-gray-600 mb-1">
                                        Note client :
                                      </p>
                                      <p className="text-gray-500 italic">
                                        "{o.notes}"
                                      </p>
                                    </div>
                                  )}
                                </div>

                                <div className="">
                                  {![
                                    "SHIPPED",
                                    "DELIVERED",
                                    "REFUNDED",
                                  ].includes(o.status) && (
                                    <button
                                      onClick={() => setReceiptOrder(o)}
                                      className="flex items-center gap-1.5 text-[12px] text-gray-500
               hover:text-gray-700 border border-gray-200 hover:border-gray-300
               px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                      <FiPrinter size={12} />
                                      Reçu
                                    </button>
                                  )}
                                  {receiptOrder && (
                                    <OrderReceipt
                                      order={receiptOrder}
                                      onClose={() => setReceiptOrder(null)}
                                    />
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Footer : résumé + alertes + pagination ── */}
          <div className="px-4 py-2.5 border-t bg-gray-50 text-[12px] text-gray-400 flex items-center justify-between flex-wrap gap-2">
            {/* Résumé gauche */}
            <span>
              {totalCount} commande{totalCount !== 1 ? "s" : ""}
              {statusFilter2
                ? ` · statut "${STATUS_LABELS[statusFilter2]}"`
                : ""}
            </span>

            {/* Droite : abandon + pagination */}
            <div className="flex items-center gap-4">
              {orders.filter((o) => o.no_more_delivery).length > 0 && (
                <span className="text-red-500 font-medium flex items-center gap-1">
                  <FiAlertTriangle size={11} />
                  {orders.filter((o) => o.no_more_delivery).length} en abandon
                </span>
              )}

              {/* Pagination inline */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  {/* Première page */}
                  <button
                    disabled={page <= 1}
                    onClick={() => handlePageChange(1)}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 6,
                      border: `1px solid ${T.border}`,
                      background: T.card,
                      color: page <= 1 ? T.muted : T.text,
                      cursor: page <= 1 ? "not-allowed" : "pointer",
                      fontSize: 11,
                      opacity: page <= 1 ? 0.4 : 1,
                    }}
                    title="Première page"
                  >
                    «
                  </button>

                  {/* Page précédente */}
                  <button
                    disabled={page <= 1}
                    onClick={() => handlePageChange(page - 1)}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 6,
                      border: `1px solid ${T.border}`,
                      background: T.card,
                      color: page <= 1 ? T.muted : T.text,
                      cursor: page <= 1 ? "not-allowed" : "pointer",
                      fontSize: 11,
                      opacity: page <= 1 ? 0.4 : 1,
                    }}
                  >
                    ‹
                  </button>

                  {/* Pages numérotées (fenêtre glissante ±2) */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 || p === totalPages || Math.abs(p - page) <= 2,
                    )
                    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                        acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "…" ? (
                        <span
                          key={`ellipsis-${i}`}
                          style={{
                            padding: "0 4px",
                            color: T.muted,
                            fontSize: 11,
                          }}
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => handlePageChange(p as number)}
                          style={{
                            padding: "3px 8px",
                            borderRadius: 6,
                            border: `1px solid ${
                              page === p ? T.accent : T.border
                            }`,
                            background: page === p ? T.accent : T.card,
                            color: page === p ? "white" : T.text,
                            cursor: "pointer",
                            fontSize: 11,
                            fontWeight: page === p ? 700 : 400,
                            minWidth: 28,
                          }}
                        >
                          {p}
                        </button>
                      ),
                    )}

                  {/* Page suivante */}
                  <button
                    disabled={page >= totalPages}
                    onClick={() => handlePageChange(page + 1)}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 6,
                      border: `1px solid ${T.border}`,
                      background: T.card,
                      color: page >= totalPages ? T.muted : T.text,
                      cursor: page >= totalPages ? "not-allowed" : "pointer",
                      fontSize: 11,
                      opacity: page >= totalPages ? 0.4 : 1,
                    }}
                  >
                    ›
                  </button>

                  {/* Dernière page */}
                  <button
                    disabled={page >= totalPages}
                    onClick={() => handlePageChange(totalPages)}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 6,
                      border: `1px solid ${T.border}`,
                      background: T.card,
                      color: page >= totalPages ? T.muted : T.text,
                      cursor: page >= totalPages ? "not-allowed" : "pointer",
                      fontSize: 11,
                      opacity: page >= totalPages ? 0.4 : 1,
                    }}
                    title="Dernière page"
                  >
                    »
                  </button>

                  <span style={{ color: T.muted, fontSize: 11, marginLeft: 4 }}>
                    Page {page}/{totalPages}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
