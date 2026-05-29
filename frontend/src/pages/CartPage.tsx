// src/pages/CartPage.tsx
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../hooks/index";
import {
  selectCart,
  removeCartItem,
  updateCartItem,
  removeLocalItem,
  updateLocalItem,
  clearCart,
  resetCart,
} from "../store/slices/cartSlice";
import { selectIsAuthenticated } from "../store/slices/authSlice";
import {
  FiTrash2,
  FiMinus,
  FiPlus,
  FiShoppingBag,
  FiArrowLeft,
} from "react-icons/fi";
import type { CartItem } from "../types/index";
import { buildImageUrl } from "../store/slices/images";

export default function CartPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isAuth = useAppSelector(selectIsAuthenticated);
  // const { items, total, loading } = useAppSelector(selectCart);
  const { items, total } = useAppSelector(selectCart);

  const numTotal = typeof total === "string" ? parseFloat(total) : total;

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

  if (items.length === 0)
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <FiShoppingBag className="text-8xl text-gray-200 mx-auto mb-6" />
        <h1 className="text-2xl font-medium text-gray-700 mb-2">
          Votre panier est vide
        </h1>
        <p className="text-gray-400 mb-8">
          Découvrez nos produits et ajoutez-les à votre panier
        </p>
        <Link
          to="/products"
          className="btn-primary px-8 py-3 rounded-full text-[15px] inline-block"
        >
          Découvrir nos produits
        </Link>
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate("/products")}
          className="text-gognet-blue hover:underline flex items-center gap-1 text-[13px]"
        >
          <FiArrowLeft /> Continuer les achats
        </button>
        <h1 className="text-2xl font-medium">
          Panier ({items.length} article{items.length !== 1 ? "s" : ""})
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Liste articles */}
        <div className="bg-white rounded-lg shadow-card divide-y">
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
                className="flex gap-4 p-4 hover:bg-gray-50 transition-colors"
              >
                {/* Image */}
                <Link
                  to={`/products/${item.product_slug}`}
                  className="w-24 h-24 flex-shrink-0"
                >
                  <div className="w-full h-full bg-gray-100 rounded border border-gray-200 flex items-center justify-center overflow-hidden">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={item.product_name}
                        className="w-40 h-40 object-contain"
                      />
                    ) : (
                      <span className="text-3xl">📦</span>
                    )}
                  </div>
                </Link>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <Link to={`/products/${item.product_slug}`}>
                    <p className="text-[14px] text-gray-800 font-medium hover:text-gognet-blue hover:underline line-clamp-2 mb-1">
                      {item.product_name}
                    </p>
                  </Link>
                  <p className="text-[12px] text-green-600 font-medium mb-3">
                    En stock
                  </p>

                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Quantité */}
                    <div className="flex items-center border rounded overflow-hidden">
                      {item.quantity > 1 ? (
                        <button
                          title="-"
                          onClick={() => handleQty(item, -1)}
                          className="px-3 py-1.5 hover:bg-gray-100 transition-colors"
                        >
                          <FiMinus className="text-[11px]" />
                        </button>
                      ) : (
                        <button
                          aria-label="Supprimer"
                          onClick={() => handleRemove(item)}
                          className="px-3 py-1.5 hover:bg-gray-100 transition-colors hover:text-red-600"
                        >
                          <FiTrash2 className="text-[10px]" />
                        </button>
                      )}
                      <span className="px-4 py-1.5 text-[13px] font-bold border-x">
                        {item.quantity}
                      </span>
                      <button
                        title="+"
                        onClick={() => handleQty(item, +1)}
                        className="px-3 py-1.5 hover:bg-gray-100 transition-colors"
                      >
                        <FiPlus className="text-[11px]" />
                      </button>
                    </div>

                    {/* Supprimer */}
                    <button
                      onClick={() => handleRemove(item)}
                      className="flex items-center gap-1 text-[13px] text-gognet-blue hover:text-red-600 hover:underline transition-colors"
                    >
                      <FiTrash2 className="text-[12px]" /> Supprimer
                    </button>
                  </div>
                </div>

                {/* Prix */}
                <div className="text-right flex-shrink-0">
                  <p className="text-[18px] font-bold text-gray-900">
                    {sub.toFixed(2)} DT
                  </p>
                  <p className="text-[12px] text-gray-400">
                    {price.toFixed(2)} DT / unité
                  </p>
                </div>
              </div>
            );
          })}

          {/* Vider le panier */}
          <div className="p-4 flex justify-end">
            <button
              onClick={() =>
                isAuth ? dispatch(clearCart()) : dispatch(resetCart())
              }
              className="text-[13px] text-gognet-blue hover:text-red-600 hover:underline transition-colors flex items-center gap-1"
            >
              <FiTrash2 /> Vider le panier
            </button>
          </div>
        </div>

        {/* Récapitulatif */}
        <div className="bg-white rounded-lg shadow-card p-5 h-fit sticky top-20">
          {Number(numTotal.toFixed(2)) > 300 && (
            <div className="bg-green-50 border border-green-200 rounded p-3 mb-4 text-[13px] text-green-700">
              ✓ Votre commande est éligible à la livraison gratuite
            </div>
          )}

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-[14px]">
              <span className="text-gray-600">
                Sous-total (
                {items.reduce((a: number, i: CartItem) => a + i.quantity, 0)}{" "}
                articles)
              </span>
              <span className="font-medium">{numTotal.toFixed(2)} DT</span>
            </div>
            {/* prix de timbre 1DT */}
            <div className="flex justify-between text-[14px]">
              <span className="text-gray-600">Timbre fiscale</span>
              <span className="font-medium">{1.0} DT</span>
            </div>
            <div className="flex justify-between text-[14px]">
              <span className="text-gray-600">Livraison</span>
              <span
                className={`font-medium ${Number(numTotal.toFixed(2)) > 300 && "text-green-600"}`}
              >
                {Number(numTotal.toFixed(2)) > 300 ? "Gratuite" : 8 + " DT"}
              </span>
            </div>
            <div className="border-t pt-2 flex justify-between text-[17px] font-bold">
              <span>Total</span>
              <span className="text-gognet-red">
                {Number(numTotal.toFixed(2)) > 300
                  ? (numTotal + 1).toFixed(2)
                  : (numTotal + 9).toFixed(2)}{" "}
                DT
              </span>
            </div>
          </div>

          <Link to={`${isAuth ? "/checkout" : "/login?next=/checkout"}`}>
            <button className="btn-secondary w-full py-3 text-[15px] rounded-sm hover:scale-[1.02] transition-transform">
              Passer la commande →
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
