// src/components/layout/NotificationsBox.tsx
// Boîte de notifications admin — polling SSE
// Charge automatiquement les nouvelles commandes sans refresh de page.
//
// polling toutes les 30s via setInterval.

import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { FiBell, FiX, FiShoppingBag } from "react-icons/fi";
import api from "../../services/api";
import { useAppSelector } from "../../hooks";
import { selectIsAdmin } from "../../store/slices/authSlice";
import type { Order } from "../../types";

const POLL_INTERVAL_MS = 30_000; // 30 secondes

// Formate "il y a X min/h"
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-indigo-100 text-indigo-700",
  SHIPPED: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};
const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  PROCESSING: "En préparation",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

export default function NotificationsBox() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [unread, setUnread] = useState(0);
  const [lastChecked, setLastChecked] = useState<string>(
    () =>
      localStorage.getItem("notif_last_checked") || new Date().toISOString(),
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch des commandes récentes ──────────────────────────
  const fetchOrders = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await api.get<{ results: Order[] }>(
        "/orders/?ordering=-created_at&page_size=15",
      );
      const list = data.results || [];
      setOrders(list);

      // Compter les commandes plus récentes que lastChecked
      const newCount = list.filter(
        (o) => new Date(o.created_at) > new Date(lastChecked),
      ).length;
      setUnread(newCount);
    } catch {
      // Silencieux — ne pas montrer d'erreur pour le polling
    }
  }, [isAdmin, lastChecked]);

  // ── Polling automatique ───────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;

    fetchOrders(); // charge immédiatement au mount

    intervalRef.current = setInterval(fetchOrders, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAdmin, fetchOrders]);

  // ── Marquer comme lu quand on ouvre ──────────────────────
  const handleOpen = () => {
    setOpen(true);
    const now = new Date().toISOString();
    setLastChecked(now);
    setUnread(0);
    localStorage.setItem("notif_last_checked", now);
  };

  if (!isAdmin) return null;

  return (
    <div className="relative">
      {/* ── Bouton cloche ── */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        className="relative p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <FiBell size={20} />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white
                           text-[10px] font-bold rounded-full flex items-center justify-center
                           animate-bounce"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* ── Panel notifications ── */}
      {open && (
        <>
          {/* Overlay pour fermer */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />

          <div
            className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl
                           shadow-2xl border border-gray-100 z-40 overflow-hidden"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3
                            bg-gognet-dark text-white"
            >
              <div className="flex items-center gap-2">
                <FiBell size={15} />
                <span className="font-semibold text-[14px]">
                  Commandes récentes
                </span>
              </div>
              <button
                title="fermer"
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
              >
                <FiX size={14} />
              </button>
            </div>

            {/* Rafraîchissement manuel */}
            <div
              className="flex items-center justify-between px-4 py-2
                            border-b border-gray-100 bg-gray-50"
            >
              <span className="text-[11px] text-gray-400">
                Actualisation auto toutes les 30s
              </span>
              <button
                onClick={fetchOrders}
                className="text-[11px] text-gognet-blue hover:underline"
              >
                ↻ Actualiser
              </button>
            </div>

            {/* Liste commandes */}
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {orders.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-gray-400">
                  <FiShoppingBag size={28} className="mb-2 opacity-40" />
                  <p className="text-[13px]">Aucune commande récente</p>
                </div>
              ) : (
                orders.map((order) => {
                  const isNew =
                    new Date(order.created_at) > new Date(lastChecked);
                  return (
                    <div
                      key={order.id}
                      className={`px-4 py-3 hover:bg-gray-50 transition-colors
                        ${isNew ? "bg-orange-50 border-l-2 border-gognet-orange" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[12px] font-bold text-gognet-blue">
                              {order.order_number}
                            </span>
                            {isNew && (
                              <span
                                className="text-[9px] bg-gognet-orange text-white
                                               px-1.5 py-0.5 rounded-full font-bold"
                              >
                                NEW
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-gray-600 truncate">
                            {order.shipping_full_name ||
                              order.items[0]?.product_name ||
                              "—"}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                              ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"}`}
                            >
                              {STATUS_LABELS[order.status] || order.status}
                            </span>
                            <span className="text-[11px] font-bold text-gognet-red">
                              {parseFloat(String(order.total_amount)).toFixed(
                                2,
                              )}{" "}
                              DT
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[11px] text-gray-400 whitespace-nowrap">
                            {timeAgo(order.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t bg-gray-50 text-center">
              <Link
                to="/dashboards"
                onClick={() => setOpen(false)}
                className="text-[13px] text-gognet-blue hover:underline font-medium"
              >
                Gérer toutes les commandes →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
