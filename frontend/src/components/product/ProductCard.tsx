import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../hooks/index";
import { addToCart, addLocalItem } from "../../store/slices/cartSlice";
import { selectIsAuthenticated } from "../../store/slices/authSlice";
import toast from "react-hot-toast";
import Stars from "../common/Stars";
import type { Product } from "../../types/index";
import { buildImageUrl } from "../../store/slices/images";

interface ProductCardProps {
  product: Product;
  showMLBadge?: boolean;
}

function getCategoryEmoji(name = ""): string {
  const map: Record<string, string> = {
    électronique: "💻",
    mode: "👗",
    maison: "🏠",
    sports: "⚽",
    beauté: "💄",
    livres: "📚",
    "jeux vidéo": "🎮",
    auto: "🚗",
    jardin: "🌿",
    cuisine: "🍳",
    téléphone: "📱",
    audio: "🎧",
    photo: "📷",
    informatique: "🖥️",
  };
  const lname = name.toLowerCase();
  for (const [key, emoji] of Object.entries(map)) {
    if (lname.includes(key)) return emoji;
  }
  return "📦";
}

export default function ProductCard({
  product,
  showMLBadge = false,
}: ProductCardProps) {
  const dispatch = useAppDispatch();
  const isAuth = useAppSelector(selectIsAuthenticated);

  const price =
    typeof product.price === "string"
      ? parseFloat(product.price)
      : product.price;
  const origPrice = product.original_price
    ? typeof product.original_price === "string"
      ? parseFloat(product.original_price)
      : product.original_price
    : null;
  const discount = origPrice ? Math.round((1 - price / origPrice) * 100) : 0;

  const thumbnail =
    buildImageUrl(product.image) ??
    buildImageUrl(product.images?.[0]?.image) ??
    null;

  // console.log({
  //   name: product.name,
  //   raw_image: product.image,
  //   raw_gallery: product.images?.[0]?.image,
  //   thumbnail,
  // });
  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (isAuth) {
        await dispatch(addToCart({ productId: product.id })).unwrap();
      } else {
        dispatch(
          addLocalItem({
            product_id: product.id,
            product_name: product.name,
            product_image: thumbnail,
            product_slug: product.slug,
            price,
          }),
        );
      }
    } catch (err: unknown) {
      const msg =
        typeof err === "string" ? err : "Erreur lors de l'ajout au panier";
      toast.error(msg);
    }
  };

  // FIX: Link vers /products/:slug et non /produits
  return (
    <Link
      to={`/products/${product.slug}`}
      className="product-card block group relative lg:w-70"
    >
      {/* Badges */}
      {discount > 0 && (
        <span className="absolute top-2 left-2 z-10 badge-discount">
          -{discount}%
        </span>
      )}
      {showMLBadge && (
        <span className="absolute top-2 right-2 z-10 badge-ml">🤖 IA</span>
      )}

      {/* Image */}
      <div className="flex items-center justify-center h-40 mb-3 overflow-hidden bg-gray-50 rounded">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={product.name}
            className="h-50 w-50 object-contain group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <span className="text-5xl group-hover:scale-110 transition-transform duration-300">
            {getCategoryEmoji(product.category_name)}
          </span>
        )}
      </div>

      {/* Nom */}
      <p className="text-[15px] text-gray-800 line-clamp-2 mb-1.5 leading-snug min-h-[2.5em]">
        {product.name}
      </p>

      {/* Stars */}
      <div className="flex items-center gap-1.5 mb-1">
        <Stars rating={product.average_rating || 0} />
        {product.review_count > 0 && (
          <span className="text-[13px] text-gognet-blue">
            ({product.review_count.toLocaleString()})
          </span>
        )}
      </div>

      <div className="h-24">
        {/* Prix */}
        <div className="mb-1">
          <span className="text-[13px] align-super text-gray-800">DT </span>
          <span className="text-[22px] font-medium text-gray-900">
            {Math.floor(price)}
          </span>
          <span className="text-[11px] text-gray-800">
            ,{String((price % 1).toFixed(2)).slice(2)}
          </span>
          {origPrice && discount > 0 && (
            <div className="text-[14px] text-gognet-gray line-through">
              DT {origPrice.toFixed(2)}
            </div>
          )}
        </div>

        {/* <p className="badge-prime mb-2 text-[12px]">
          ✓ Livraison rapide disponible
        </p> */}

        {product.stock_quantity < 5 && product.stock_quantity > 0 && (
          <p className="text-[12px] text-gognet-red mb-2 font-medium">
            ⚠ Plus que {product.stock_quantity} en stock
          </p>
        )}
        {product.stock_quantity === 0 && (
          <p className="text-[12px] text-gognet-gray mb-2">Rupture de stock</p>
        )}
      </div>

      {/* Bouton */}
      <button
        onClick={handleAdd}
        disabled={product.stock_quantity === 0}
        className="mt-0.5 btn-secondary py-2 w-full text-[14px] disabled:opacity-50 disabled:cursor-not-allowed 
                   hover:scale-[1.02] active:scale-95 transition-transform duration-150"
      >
        Ajouter au panier
      </button>
    </Link>
  );
}
