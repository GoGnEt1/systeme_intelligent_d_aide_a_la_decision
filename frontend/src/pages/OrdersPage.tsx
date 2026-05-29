import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import Spinner from "../components/common/Spinner";
import toast from "react-hot-toast";
import {
  FiChevronDown,
  FiChevronUp,
  FiX,
  FiAlertTriangle,
  FiClock,
} from "react-icons/fi";
import type { Order, OrderStatus, OrderStatusHistory } from "../types";
import { buildImageUrl } from "../store/slices/images";

// ── Configuration statut ──────────────────────────────────
const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  PENDING: {
    label: "En attente",
    color: "text-yellow-700",
    bg: "bg-yellow-100",
    icon: "⏳",
  },
  CONFIRMED: {
    label: "Confirmée",
    color: "text-blue-700",
    bg: "bg-blue-100",
    icon: "✅",
  },
  PROCESSING: {
    label: "En préparation",
    color: "text-indigo-700",
    bg: "bg-indigo-100",
    icon: "🔧",
  },
  SHIPPED: {
    label: "Expédiée",
    color: "text-purple-700",
    bg: "bg-purple-100",
    icon: "🚚",
  },
  DELIVERED: {
    label: "Livrée",
    color: "text-green-700",
    bg: "bg-green-100",
    icon: "🎉",
  },
  CANCELLED: {
    label: "Annulée",
    color: "text-red-700",
    bg: "bg-red-100",
    icon: "❌",
  },
  REFUNDED: {
    label: "Remboursée",
    color: "text-gray-700",
    bg: "bg-gray-100",
    icon: "↩️",
  },
};

const PAYMENT_LABELS: Record<string, string> = {
  COD: "💵 Paiement à la livraison",
  MOBILE: "📱 Paiement mobile (i-Dinar)",
  CARD: "💳 Carte bancaire",
};

// ── Composant Timeline statut ──────────────────────────────
function StatusTimeline({ history }: { history: OrderStatusHistory[] }) {
  if (!history || history.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-[12px] font-semibold text-gray-500 mb-2">
        Historique de la commande
      </p>
      <div className="relative pl-5">
        {/* Ligne verticale */}
        <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gray-200" />
        {[...history].reverse().map((h, i) => (
          <div key={h.id} className="relative mb-3 last:mb-0">
            {/* Point */}
            <div
              className={`absolute -left-[15px] w-3 h-3 rounded-full border-2 border-white
              ${i === 0 ? "bg-gognet-orange" : "bg-gray-300"}`}
            />
            <div className="flex items-start justify-between gap-2">
              <div>
                <span
                  className={`text-[12px] font-semibold
                  ${STATUS_CONFIG[h.new_status as OrderStatus]?.color || "text-gray-700"}`}
                >
                  {h.new_status_display}
                </span>
                {h.note && (
                  <p className="text-[11px] text-gray-400 italic mt-0.5">
                    "{h.note}"
                  </p>
                )}
                <p className="text-[11px] text-gray-400">
                  par {h.changed_by_name}
                </p>
              </div>
              <span className="text-[11px] text-gray-400 flex-shrink-0">
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
    </div>
  );
}

// ── Composant : bannière absence livraison ────────────────────
function DeliveryAbsenceBanner({ order }: { order: Order }) {
  const attempts = order.delivery_attempts ?? 0;
  const noMore = order.no_more_delivery ?? false;

  // Rien à afficher si pas encore de tentative
  if (attempts === 0 && !noMore) return null;

  if (noMore) {
    return (
      <div
        className="flex items-start gap-2 bg-red-50 border border-red-200
                      rounded-lg px-4 py-3 mt-3 text-[12px]"
      >
        <FiAlertTriangle
          className="text-red-500 mt-0.5 flex-shrink-0"
          size={14}
        />
        <div>
          <p className="font-semibold text-red-700">Livraison impossible</p>
          <p className="text-red-600 mt-0.5">
            Après 2 tentatives de livraison infructueuses, cette commande ne
            peut plus être expédiée. Contactez le service client pour toute
            question.
          </p>
        </div>
      </div>
    );
  }

  // 1ère absence — nouvelle date prévue
  return (
    <div
      className="flex items-start gap-2 bg-orange-50 border border-orange-200
                    rounded-lg px-4 py-3 mt-3 text-[12px]"
    >
      <FiClock className="text-orange-500 mt-0.5 flex-shrink-0" size={14} />
      <div>
        <p className="font-semibold text-orange-700">
          Tentative de livraison manquée ({attempts}/2)
        </p>
        {order.delivery_date ? (
          <p className="text-orange-600 mt-0.5">
            Une nouvelle livraison est prévue le{" "}
            <strong>
              {new Date(order.delivery_date).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </strong>
            . Veuillez vous assurer d'être présent(e).
            <br />
            <span className="text-red-500 font-medium">
              ⚠ En cas de nouvelle absence, la livraison sera définitivement
              annulée.
            </span>
          </p>
        ) : (
          <p className="text-orange-600 mt-0.5">
            Notre livreur n'a pas pu vous joindre. Une nouvelle date sera
            communiquée prochainement.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Composant : ligne de date de livraison prévue ─────────────
function DeliveryDateBadge({ order }: { order: Order }) {
  if (!order.delivery_date) return null;
  if (
    order.status === "DELIVERED" ||
    order.status === "CANCELLED" ||
    order.status === "REFUNDED"
  )
    return null;

  const date = new Date(order.delivery_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = date < today;

  return (
    <div
      className={`flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full font-medium
      ${
        isPast
          ? "bg-red-100 text-red-700"
          : "bg-blue-50 text-blue-700 border border-blue-200"
      }`}
    >
      <FiClock size={11} />
      {isPast ? "Livraison prévue le " : "Livraison prévue le "}
      <span className="font-bold">
        {date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
      </span>
      {isPast && <span className="ml-1 text-red-500">(passée)</span>}
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<number | null>(null);

  const loadOrders = useCallback(() => {
    setLoading(true);
    api
      .get<{ results: Order[] }>("/orders/")
      .then(({ data }) => setOrders(data.results || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleCancel = async (orderId: number) => {
    setCancellingId(orderId);
    try {
      const { data } = await api.post(`/orders/${orderId}/cancel/`);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...data } : o)),
      );
      toast.success("Commande annulée avec succès.");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(
        e.response?.data?.error || "Impossible d'annuler cette commande.",
      );
    } finally {
      setCancellingId(null);
      setConfirmCancel(null);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto px-4 py-4">
      <h1 className="text-2xl font-medium mb-5">Mes commandes</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg shadow-card">
          <p className="text-5xl mb-4">📦</p>
          <h2 className="text-xl font-medium text-gray-700 mb-2">
            Aucune commande
          </h2>
          <p className="text-gray-400 mb-6">
            Vous n&apos;avez pas encore passé de commande
          </p>
          <Link to="/products">
            <button className="btn-primary px-8 py-3 rounded">
              Commencer mes achats
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
            const total =
              typeof order.total_amount === "string"
                ? parseFloat(order.total_amount)
                : order.total_amount;
            const subtotal =
              typeof order.subtotal === "string"
                ? parseFloat(order.subtotal)
                : order.subtotal;
            const shipping =
              typeof order.shipping_cost === "string"
                ? parseFloat(order.shipping_cost)
                : order.shipping_cost;
            const tva =
              typeof order.tva_timbre === "string"
                ? parseFloat(order.tva_timbre || "1")
                : order.tva_timbre || 1;
            const isExpanded = expandedId === order.id;
            const noMore = order.no_more_delivery ?? false;
            const attempts = order.delivery_attempts ?? 0;

            return (
              <div
                key={order.id}
                className={`bg-white rounded-lg shadow-card overflow-hidden transition-shadow
                  ${noMore ? "border-l-4 border-red-400" : ""}`}
              >
                {/* ── Header commande ── */}
                <div className="bg-gray-50 border-b px-5 py-3 flex flex-wrap items-center gap-3 text-[13px]">
                  <div>
                    <span className="text-gray-500">Le </span>
                    <span className="font-bold">
                      {new Date(order.created_at).toLocaleDateString("fr-FR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Total : </span>
                    <span className="font-bold text-gognet-red">
                      {total.toFixed(2)} DT
                    </span>
                  </div>

                  {/* Date de livraison prévue — visible dans le header si SHIPPED */}
                  {order.status === "SHIPPED" && (
                    <DeliveryDateBadge order={order} />
                  )}

                  {order.payment && (
                    <div className="text-gray-500 text-[12px]">
                      {PAYMENT_LABELS[order.payment.method] ||
                        order.payment.method_display}
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[12px] text-gognet-blue font-mono">
                      {order.order_number}
                    </span>
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : order.id)
                      }
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title={isExpanded ? "Réduire" : "Voir les détails"}
                    >
                      {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                    </button>
                  </div>
                </div>

                {/* ── Corps ── */}
                <div className="px-5 py-4">
                  {/* Statut + bouton annulation */}
                  <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{cfg.icon}</span>
                      <span
                        className={`text-[13px] font-bold px-3 py-1 rounded-full ${cfg.bg} ${cfg.color}`}
                      >
                        {cfg.label}
                      </span>

                      {/* Badge tentatives de livraison */}
                      {attempts > 0 && !noMore && (
                        <span
                          className="text-[11px] bg-orange-100 text-orange-700
                                         px-2 py-0.5 rounded-full font-medium border border-orange-200"
                        >
                          ⚠ {attempts}/2 tentative{attempts > 1 ? "s" : ""}
                        </span>
                      )}
                      {noMore && (
                        <span
                          className="text-[11px] bg-red-100 text-red-700
                                         px-2 py-0.5 rounded-full font-medium border border-red-200"
                        >
                          ⛔ Livraison impossible
                        </span>
                      )}

                      {order.delivered_at && (
                        <span className="text-[12px] text-gray-500">
                          · livré le{" "}
                          {new Date(order.delivered_at).toLocaleDateString(
                            "fr-FR",
                          )}
                        </span>
                      )}
                    </div>

                    {/* Bouton annulation client */}
                    {order.can_cancel &&
                      (confirmCancel === order.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] text-gray-600">
                            Confirmer l&apos;annulation ?
                          </span>
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={cancellingId === order.id}
                            className="text-[12px] bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded
                                       transition-colors disabled:opacity-60 flex items-center gap-1"
                          >
                            {cancellingId === order.id ? (
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <FiX size={12} />
                            )}
                            Oui, annuler
                          </button>
                          <button
                            onClick={() => setConfirmCancel(null)}
                            className="text-[12px] text-gray-500 hover:text-gray-700 px-2 py-1"
                          >
                            Non
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmCancel(order.id)}
                          className="text-[12px] text-red-500 hover:text-red-700 border border-red-200
                                     hover:border-red-400 px-3 py-1 rounded transition-colors"
                        >
                          Annuler la commande
                        </button>
                      ))}
                  </div>

                  {/* Bannière absence livraison — visible dès qu'il y a au moins 1 tentative */}
                  <DeliveryAbsenceBanner order={order} />

                  {/* Articles (preview : max 2, le reste en "voir plus") */}
                  <div className="space-y-2 mb-3">
                    {order.items
                      .slice(0, isExpanded ? undefined : 2)
                      .map((item) => {
                        const itemPrice =
                          typeof item.unit_price === "string"
                            ? parseFloat(item.unit_price)
                            : item.unit_price;
                        const thumbnail =
                          buildImageUrl(item.product_image) ?? null;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3"
                          >
                            <div
                              className="w-10 h-10 bg-white rounded border border-gray-200
                                          flex items-center justify-center flex-shrink-0 overflow-hidden"
                            >
                              {thumbnail ? (
                                <img
                                  src={thumbnail}
                                  alt={item.product_name}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <span className="text-lg">📦</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-gray-800 line-clamp-1">
                                {item.product_name}
                              </p>
                              <p className="text-[12px] text-gray-500">
                                {item.quantity} × {itemPrice.toFixed(2)} DT
                              </p>
                            </div>
                            <p className="text-[13px] font-bold text-gray-900 flex-shrink-0">
                              {(itemPrice * item.quantity).toFixed(2)} DT
                            </p>
                          </div>
                        );
                      })}
                    {!isExpanded && order.items.length > 2 && (
                      <button
                        onClick={() => setExpandedId(order.id)}
                        className="text-[12px] text-gognet-blue hover:underline"
                      >
                        + {order.items.length - 2} autre
                        {order.items.length - 2 > 1 ? "s" : ""} article
                        {order.items.length - 2 > 1 ? "s" : ""}
                      </button>
                    )}
                  </div>

                  {/* Détails étendus */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      {/* Date livraison prévue (en dehors du header si on est pas en SHIPPED) */}
                      {order.delivery_date && order.status !== "SHIPPED" && (
                        <div className="text-[12px] text-gray-500 flex items-center gap-1.5">
                          <FiClock size={12} />
                          Date de livraison prévue :{" "}
                          <span className="font-medium text-gray-700">
                            {new Date(order.delivery_date).toLocaleDateString(
                              "fr-FR",
                              {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </div>
                      )}

                      {/* Totaux détaillés */}
                      <div className="bg-gray-50 rounded-lg p-3 text-[13px] space-y-1 mb-3">
                        <div className="flex justify-between text-gray-600">
                          <span>Sous-total</span>
                          <span>{subtotal.toFixed(2)} DT</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>Frais de livraison</span>
                          <span
                            className={
                              shipping === 0 ? "text-green-600 font-medium" : ""
                            }
                          >
                            {shipping === 0
                              ? "Gratuit"
                              : `${shipping.toFixed(2)} DT`}
                          </span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>TVA / Timbre</span>
                          <span>{Number(tva).toFixed(2)} DT</span>
                        </div>
                        <div className="flex justify-between font-bold text-[15px] border-t pt-1">
                          <span>Total TTC</span>
                          <span className="text-gognet-red">
                            {total.toFixed(2)} DT
                          </span>
                        </div>
                      </div>

                      {/* Adresse snapshot */}
                      {order.shipping_full_name && (
                        <div className="bg-gray-50 rounded-lg p-3 text-[12px] text-gray-600 mb-3">
                          <p className="font-semibold text-gray-700 mb-1">
                            📍 Livraison à :
                          </p>
                          <p>
                            {order.shipping_full_name} · {order.shipping_phone}
                          </p>
                          <p>{order.shipping_address_line}</p>
                          <p>
                            {order.shipping_postal_code} {order.shipping_city},{" "}
                            {order.shipping_country}
                          </p>
                        </div>
                      )}

                      {/* Timeline historique */}
                      {order.status_history &&
                        order.status_history.length > 0 && (
                          <StatusTimeline history={order.status_history} />
                        )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
