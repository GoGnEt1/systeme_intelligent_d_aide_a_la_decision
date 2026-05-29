import { useEffect, useRef } from "react";
import Stars from "../common/Stars";
import type { Product } from "../../types";

interface Props {
  product: Product;
}

export default function ProductReviews({ product }: Props) {
  const sectionRef = useRef<HTMLDivElement>(null);

  // Scroll vers la section si l'URL contient #reviews
  // Se déclenche quand le composant est monté (reviews disponibles dans le DOM)
  useEffect(() => {
    if (window.location.hash === "#reviews" && sectionRef.current) {
      // Petit délai pour laisser le layout se stabiliser après le rendu
      const timer = setTimeout(() => {
        sectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []); // [] = une seule fois au mount, quand les reviews sont présentes

  //   if (!product.reviews?.length) return null;
  const displayedReviews = product.reviews?.slice(0, 5) || [];
  const remainingReviews =
    (product.reviews?.length || 0) - displayedReviews.length;

  return (
    // {product.reviews && product.reviews.length > 0 && (
    <div
      id="reviews"
      ref={sectionRef}
      className="mt-6 bg-white rounded-lg shadow-card p-5"
    >
      <h2 className="font-bold text-[18px] mb-4">
        Avis clients
        <span className="ml-2 text-[15px] text-gray-500 font-normal">
          ({product.review_count})
        </span>
      </h2>
      <div className="space-y-4">
        {!product.reviews || product.reviews?.length === 0 ? (
          <p className="text-[14px] text-gray-400 py-4 text-center">
            Aucun avis pour l'instant. Soyez le premier à donner votre avis !{" "}
            {product.name}
          </p>
        ) : (
          <div className="space-y-4">
            {/* {product.reviews.map((r) => ( */}
            {displayedReviews.map((r) => (
              <div key={r.id} className="border-b pb-4 last:border-0">
                <div className="flex items-center gap-3 mb-1">
                  <Stars rating={r.rating} />
                  {r.is_verified_purchase && (
                    <span className="text-[13px] text-gognet-blue bg-blue-50 px-2 py-0.5 rounded-full">
                      ✓ Achat vérifié
                    </span>
                  )}
                </div>
                {r.title && (
                  <p className="font-bold text-[14px] mb-1">{r.title}</p>
                )}
                <p className="text-[14px] text-gray-600">{r.comment}</p>
                <p className="text-[13px] text-gray-400 mt-1">
                  Par {r.user_name} ·{" "}
                  {new Date(r.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
            ))}

            {remainingReviews > 0 && (
              <div className="text-center pt-2">
                <p className="text-[14px] text-gray-500">
                  + {remainingReviews} avis enregistrés
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
