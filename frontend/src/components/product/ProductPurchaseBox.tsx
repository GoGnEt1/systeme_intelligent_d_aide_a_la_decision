import { useState } from "react";
import { FiShoppingCart, FiMinus, FiPlus } from "react-icons/fi";
import { useAppDispatch, useAppSelector } from "../../hooks";
import { addToCart, addLocalItem } from "../../store/slices/cartSlice";
import toast from "react-hot-toast";
import type { Product } from "../../types";
import { selectIsAuthenticated } from "../../store/slices/authSlice";
import { Link } from "react-router-dom";

interface Props {
  product: Product;
}

export default function ProductPurchaseBox({ product }: Props) {
  const dispatch = useAppDispatch();

  const [qty, setQty] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const isAuth = useAppSelector(selectIsAuthenticated);

  const price = Number(product.price);

  const handleAddToCart = async () => {
    if (!product) return;
    setAddingToCart(true);
    const price =
      typeof product.price === "string"
        ? parseFloat(product.price)
        : product.price;
    try {
      if (isAuth) {
        await dispatch(
          addToCart({ productId: product.id, quantity: qty }),
        ).unwrap();
      } else {
        // Meilleure image disponible : product.image > image primaire > première image
        const resolvedImage =
          product.image ||
          product.images?.find((img) => img.is_primary)?.image ||
          product.images?.[0]?.image ||
          null;
        for (let i = 0; i < qty; i++) {
          dispatch(
            addLocalItem({
              product_id: product.id,
              product_name: product.name,
              product_image: resolvedImage,
              price,
            }),
          );
        }
        toast.success("Ajouté au panier !");
        // dispatch(openCart());
        return;
      }
      // dispatch(openCart());
      toast.success("Ajouté au panier !");
    } catch {
      toast.error("Erreur lors de l'ajout");
    } finally {
      setAddingToCart(false);
    }
  };

  const inStock = product.stock_quantity > 0;
  const isActive = product.status === "ACTIVE";

  return (
    <div className="bg-white rounded-lg shadow-card p-5 lg:w-72 h-fit lg:sticky lg:top-20">
      <div className="text-3xl font-medium text-gognet-red mb-2">
        {price.toFixed(2)} DT
      </div>

      {/* Livraison */}
      <p className="text-[12px] text-gray-600 mb-3">
        ✓ Livraison gratuite à partir de 300 DT
      </p>

      {/* Stock */}
      <p
        className={`text-[15px] font-medium mb-3 ${inStock ? "text-green-600" : "text-gognet-red"}`}
      >
        {inStock
          ? `En stock (${product.stock_quantity} disponibles)`
          : "Rupture de stock"}
      </p>

      {/* Quantité */}
      {inStock && (
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[14px] text-gray-600">Qté :</span>
          <div className="flex items-center border rounded overflow-hidden">
            <button
              title="-"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="px-3 py-1.5 hover:bg-gray-100 transition-colors border-r"
            >
              <FiMinus className="text-[13px]" />
            </button>
            <span className="px-4 py-1.5 text-[14px] font-bold">{qty}</span>
            <button
              title="+"
              onClick={() =>
                setQty((q) => Math.min(product.stock_quantity, q + 1))
              }
              className="px-3 py-1.5 hover:bg-gray-100 transition-colors border-l"
            >
              <FiPlus className="text-[13px]" />
            </button>
          </div>
        </div>
      )}

      {/* Boutons */}
      <button
        onClick={handleAddToCart}
        disabled={!inStock || addingToCart || !isActive}
        className="btn-secondary w-full py-3 text-[14px] rounded mb-3 flex items-center justify-center gap-2
                           disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 transition-transform"
      >
        {addingToCart ? (
          <>
            <div className="w-4 h-4 border-2 border-gognet-dark border-t-transparent rounded-full animate-spin" />{" "}
            Ajout...
          </>
        ) : (
          <>
            <FiShoppingCart /> Ajouter au panier
          </>
        )}
      </button>
      {/* <button className="btn-secondary w-full py-3 text-[14px] rounded-full hover:scale-[1.02] active:scale-95 transition-transform">
                Acheter maintenant
              </button> */}

      {!isAuth && (
        <p className="text-[13px] text-center text-gray-400 mt-3">
          Vous pouvez ajouter au panier sans connexion.
          <Link to="/login" className="text-gognet-blue hover:underline ml-1">
            Connectez-vous
          </Link>{" "}
          pour passer commande.
        </p>
      )}
    </div>
  );
}

// {/* <div className="bg-white rounded-lg shadow-card p-5 lg:w-72">
//       <div className="text-2xl font-bold mb-2">{price.toFixed(2)} DT</div>

//       <p className={`mb-3 ${inStock ? "text-green-600" : "text-red-500"}`}>
//         {inStock ? "En stock" : "Rupture"}
//       </p>

//       {/* qty */}
//       <div className="flex items-center gap-3 mb-4">
//         <button
//           title="Diminuer la quantité"
//           onClick={() => setQty((q) => Math.max(1, q - 1))}
//           className="p-2 border rounded"
//         >
//           <FiMinus />
//         </button>

//         <span>{qty}</span>

//         <button
//           title="Augmenter la quantité"
//           onClick={() => setQty((q) => Math.min(product.stock_quantity, q + 1))}
//           className="p-2 border rounded"
//         >
//           <FiPlus />
//         </button>
//       </div>

//       <button
//         onClick={handleAdd}
//         disabled={!inStock || loading}
//         className="btn-secondary w-full flex items-center justify-center gap-2"
//       >
//         {loading ? (
//           "Ajout..."
//         ) : (
//           <>
//             <FiShoppingCart />
//             Ajouter au panier
//           </>
//         )}
//       </button>
//     </div> */}
