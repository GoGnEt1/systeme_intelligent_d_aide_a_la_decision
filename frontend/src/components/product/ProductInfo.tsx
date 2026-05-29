import Stars from "../common/Stars";
import { FiTruck, FiShield, FiRefreshCw } from "react-icons/fi";
import type { Product } from "../../types";

interface Props {
  product: Product;
}

export default function ProductInfo({ product }: Props) {
  const price =
    typeof product.price === "string"
      ? parseFloat(product.price)
      : product.price;
  const orig = product.original_price
    ? typeof product.original_price === "string"
      ? parseFloat(product.original_price)
      : product.original_price
    : null;
  //   const orig = product.original_price ? Number(product.original_price) : null;

  const discount = orig ? Math.round((1 - price / orig) * 100) : 0;

  const scrollToReviews = () => {
    const el = document.getElementById("reviews");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  return (
    <div className="bg-white rounded-lg shadow-card p-5 lg:w-[450px]">
      <p className="text-gognet-blue text-[16px] mb-1">
        {product.category_name}
      </p>
      <h1 className="text-[24px] font-medium text-gray-900 mb-2 leading-snug">
        {product.name}
      </h1>

      <div className="flex items-center gap-3 mb-3 pb-3 border-b">
        <Stars rating={product.average_rating} size="md" />
        {/* <a
          href="#reviews"
          className="text-gognet-blue text-[15px] hover:underline"
        >
          {product.review_count?.toLocaleString()} évaluations
        </a> */}
        <button
          onClick={scrollToReviews}
          className="text-gognet-blue text-[15px] hover:underline cursor-pointer"
        >
          {product.review_count?.toLocaleString()} évaluations
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-[14px] text-gray-500">SKU: {product.sku}</span>
      </div>

      {/* Prix */}
      <div className="mb-4 pb-4 border-b">
        {discount > 0 && orig && (
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-gognet-red text-white text-[13px] font-bold px-2 py-0.5 rounded">
              -{discount}%
            </span>
            <span className="text-[14px] text-gray-500 line-through">
              DT {orig.toFixed(2)}
            </span>
          </div>
        )}
        <div className="text-4xl font-medium text-gognet-red">
          <span className="text-xl align-super">DT </span>
          {Math.floor(price)}
          <span className="text-xl">
            ,{String((price % 1).toFixed(2)).slice(2)}
          </span>
        </div>
        {discount > 0 && orig && (
          <p className="text-[14px] text-gray-500 mt-1">
            Économisez DT {(orig - price).toFixed(2)} ({discount}% de réduction)
          </p>
        )}
      </div>

      {/* Description */}
      {product.description && (
        <div className="mb-4">
          <h2 className="font-bold text-[16px] mb-2">À propos de ce produit</h2>
          <p className="text-[15px] text-gray-600 leading-relaxed">
            {product.description}
          </p>
        </div>
      )}

      {/* Garanties */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        {[
          { icon: <FiTruck />, label: "Livraison rapide" },
          { icon: <FiShield />, label: "Garantie 2 ans" },
          { icon: <FiRefreshCw />, label: "Retour 30j" },
        ].map((g) => (
          <div
            key={g.label}
            className="bg-gray-50 rounded-lg p-2 text-[13px] text-gray-600"
          >
            <div className="text-gognet-blue text-lg flex justify-center mb-1">
              {g.icon}
            </div>
            {g.label}
          </div>
        ))}
      </div>
    </div>
  );
}
