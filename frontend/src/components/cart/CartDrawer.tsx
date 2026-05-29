// src/components/cart/CartDrawer.tsx
import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../hooks/index";
import {
  selectCart,
  updateCartItem,
  removeCartItem,
  updateLocalItem,
  removeLocalItem,
} from "../../store/slices/cartSlice";
import { selectIsAuthenticated } from "../../store/slices/authSlice";
import { FiX, FiTrash2, FiMinus, FiPlus, FiShoppingBag } from "react-icons/fi";
import type { CartItem } from "../../types/index";
import { buildImageUrl } from "../../store/slices/images";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isAuth = useAppSelector(selectIsAuthenticated);
  const { items, total, loading } = useAppSelector(selectCart);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Fermer avec Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Empêcher le scroll du body
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleQty = (item: CartItem, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      if (isAuth) {
        dispatch(removeCartItem(item.id));
      } else {
        dispatch(removeLocalItem(item.id));
      }
    } else {
      if (isAuth) {
        dispatch(updateCartItem({ itemId: item.id, quantity: newQty }));
      } else {
        dispatch(updateLocalItem({ id: item.id, quantity: newQty }));
      }
    }
  };

  const handleRemove = (item: CartItem) => {
    if (isAuth) {
      dispatch(removeCartItem(item.id));
    } else {
      dispatch(removeLocalItem(item.id));
    }
  };

  const handleCheckout = () => {
    onClose();
    if (!isAuth) {
      navigate("/login", { state: { from: "/checkout" } }); // ← redirige vers login avec destination
    } else {
      navigate("/checkout");
    }
  };

  const numTotal = typeof total === "string" ? parseFloat(total) : total;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300
                    ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed w-full max-w-lg bg-white z-50 shadow-2xl
                    flex flex-col transform transition-transform duration-300 ease-out
                    ${open ? "translate-x-0 top-24 right-4" : "translate-x-full top-0 right-0"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 bg-gognet-dark text-white border-b">
          <h2 className="font-bold text-[16px] flex items-center gap-2">
            <FiShoppingBag /> Panier ({items.length} article
            {items.length !== 1 ? "s" : ""})
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer le panier"
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 h-full max-h-64 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-gognet-orange border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-2 text-center">
              <FiShoppingBag className="text-6xl text-gray-200 mb-4" />
              <p className="text-gray-500 font-medium mb-2">
                Votre panier est vide
              </p>
              <p className="text-[13px] text-gray-400 mb-6">
                Ajoutez des articles pour commencer
              </p>
              <button onClick={onClose}>
                <Link
                  to="/products"
                  className="btn-primary px-6 py-2 rounded-full text-[13px]"
                >
                  Découvrir nos produits
                </Link>
              </button>
            </div>
          )}

          {items.map((item: CartItem) => {
            const price =
              typeof item.unit_price === "string"
                ? parseFloat(item.unit_price)
                : item.unit_price;
            const sub =
              typeof item.subtotal === "string"
                ? parseFloat(item.subtotal)
                : item.subtotal;

            const thumbnail = buildImageUrl(item.product_image) ?? null;

            return (
              <div
                key={item.id}
                className="flex gap-3 bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
              >
                {/* Image */}
                <div className="w-16 h-16 bg-white rounded border border-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {/* {item.product_image && buildImageUrl(item.product_image) ? ( */}
                  {thumbnail ? (
                    <img
                      src={thumbnail} //item.product_image item.product_image}
                      alt={item.product_name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-2xl">📦</span>
                  )}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-gray-800 line-clamp-2 font-medium mb-1">
                    {item.product_name}
                  </p>
                  <p className="text-gognet-red text-[13px] font-bold">
                    {price.toFixed(2)} DT
                  </p>
                  {/* Quantité */}
                  <div className="flex items-center gap-2 mt-1.5">
                    {item.quantity > 1 ? (
                      <button
                        aria-label="-"
                        onClick={() => handleQty(item, -1)}
                        className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center
                                 hover:bg-gray-200 transition-colors text-gray-600"
                      >
                        <FiMinus className="text-[10px]" />
                      </button>
                    ) : (
                      <button
                        aria-label="Supprimer"
                        onClick={() => handleRemove(item)}
                        className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center
                                 hover:bg-gray-200 transition-colors text-gray-500 hover:text-red-600"

                        // className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <FiTrash2 className="text-[10px]" />
                      </button>
                    )}
                    <span className="text-[13px] font-bold w-6 text-center">
                      {item.quantity}
                    </span>
                    <button
                      aria-label="+"
                      onClick={() => handleQty(item, +1)}
                      className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center
                                 hover:bg-gray-200 transition-colors text-gray-600"
                    >
                      <FiPlus className="text-[10px]" />
                    </button>
                    <button
                      aria-label="Supprimer"
                      onClick={() => handleRemove(item)}
                      className="ml-auto p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <FiTrash2 className="text-[14px]" />
                    </button>
                  </div>
                </div>

                {/* Sous-total */}
                <div className="text-right flex-shrink-0">
                  <p className="text-[13px] font-bold text-gray-800">
                    {sub.toFixed(2)} DT
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pied du drawer */}
        {items.length > 0 && (
          <div className="border-t bg-white p-4 space-y-3">
            {/* Sous-total */}
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-gray-600">
                Sous-total (
                {items.reduce((a: number, i: CartItem) => a + i.quantity, 0)}{" "}
                articles)
              </span>
              <span className="font-bold text-[16px] text-gognet-red">
                {numTotal.toFixed(2)} DT
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Livraison calculée à la commande
            </p>

            {/* CTA Principal */}
            <button
              onClick={handleCheckout}
              className="btn-secondary w-full py-3 text-[14px] font-bold rounded"
            >
              Passer la commande →
            </button>

            {/* Si non connecté, afficher note */}
            {!isAuth && (
              <p className="text-[11px] text-center text-gray-400">
                Vous devrez vous connecter pour finaliser la commande
              </p>
            )}

            <button onClick={onClose}>
              <Link
                to="/cart"
                className="block text-center text-gognet-blue text-[13px] hover:underline"
              >
                Voir le panier complet
              </Link>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
