// src/components/product/RecommendationSection.tsx
import { Link } from "react-router-dom";
import { useAppSelector } from "../../hooks/index";
import {
  selectIsAuthenticated,
  selectUser,
} from "../../store/slices/authSlice";
import { useRecommendations } from "../../hooks/useRecommendations";
import ProductCard from "./ProductCard";

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-40 bg-gray-200 rounded-lg mb-3" />
      <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
      <div className="h-5 bg-gray-200 rounded w-1/3" />
    </div>
  );
}

function SrcBadge({ src }: { src: string }) {
  const m: Record<string, { label: string; cls: string }> = {
    real_db: {
      label: "Vos achats SmartShop",
      cls: "bg-green-50 text-green-700 border-green-200",
    },
    kaggle: {
      label: "ML · Collaborative Filtering",
      cls: "bg-purple-50 text-purple-700 border-purple-200",
    },
    fallback_popular: {
      label: "Populaires",
      cls: "bg-gray-50 text-gray-600 border-gray-200",
    },
  };
  const c = m[src] ?? m.kaggle;
  return (
    <span
      className={`ml-2 text-[11px] font-normal border px-2 py-0.5 rounded-full align-middle ${c.cls}`}
    >
      {c.label}
    </span>
  );
}

export default function RecommendationSection({
  count = 6,
  showWhenGuest = true,
}: {
  count?: number;
  showWhenGuest?: boolean;
}) {
  const isAuth = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectUser);
  const { products, meta, isLoading, error, refetch } = useRecommendations({
    n: count,
    enabled: isAuth || showWhenGuest,
  });

  // if (!isAuth && !showWhenGuest) return null;
  if (error && !products.length) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-[20px] text-gray-900">
          {" "}
          {isAuth && user?.first_name
            ? `Recommandé pour vous, ${user.first_name}`
            : "Recommandé pour vous"}
          {meta && !isLoading && <SrcBadge src={meta.data_source} />}
        </h2>
        <div className="flex items-center gap-3">
          {isAuth && !isLoading && (
            <button
              onClick={refetch}
              className="text-[11px] text-gray-400 hover:text-gognet-orange transition-colors"
            >
              ↻ Actualiser
            </button>
          )}
          <Link
            to="/products"
            className="text-gognet-blue text-[13px] hover:underline"
          >
            Voir tout →
          </Link>
        </div>
      </div>

      {!isAuth && showWhenGuest && (
        <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-[13px] text-amber-800">
          {/* <span>🤖</span> */}
          <span>
            <Link to="/login" className="font-bold hover:underline">
              Connectez-vous
            </Link>{" "}
            pour des recommandations personnalisées basées sur vos achats.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {isLoading
          ? Array.from({ length: count }).map((_, i) => <Skeleton key={i} />)
          : products
              .slice(0, count)
              .map((p) => (
                <ProductCard key={p.id} product={p} showMLBadge={isAuth} />
              ))}
      </div>

      {meta && !isLoading && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
          Hybride SVD+NCF+CB · α_svd={meta.alpha_svd?.toFixed(1)} · α_cf=
          {meta.alpha_cf?.toFixed(1)}
          {!meta.user_known && " · Nouveau profil (cold start)"}
        </div>
      )}
    </div>
  );
}
