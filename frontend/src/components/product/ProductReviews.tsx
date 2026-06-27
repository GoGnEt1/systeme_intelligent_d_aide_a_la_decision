// src/components/product/ProductReviews.tsx
// ══════════════════════════════════════════════════════════════════════════════
// Affiche les avis clients avec :
//  • Vue client  : 5 avis max, puis compteur "N autres avis"
//  • Vue admin   : tous les avis dans un conteneur scrollable + barre de recherche
//    (email ou nom du client)
// ══════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, useMemo } from "react";
import Stars from "../common/Stars";
import type { Product, Review } from "../../types";
import { useAppSelector } from "../../hooks";
import {
  selectUser,
  selectIsAuthenticated,
} from "../../store/slices/authSlice";
import {
  FiSearch,
  FiX,
  FiShield,
  FiChevronDown,
  FiChevronUp,
  FiStar,
} from "react-icons/fi";

interface Props {
  product: Product;
}

// ── Statistiques des notes ────────────────────────────────────────────────────
function RatingBar({
  star,
  count,
  total,
}: {
  star: number;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="w-5 text-right text-gray-600">{star}</span>
      <span className="text-yellow-400" style={{ fontSize: 12 }}>
        ★
      </span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-yellow-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-gray-400 text-[11px]">{count}</span>
    </div>
  );
}

// ── Carte d'un avis ───────────────────────────────────────────────────────────
function ReviewCard({ r, isAdmin }: { r: Review; isAdmin: boolean }) {
  return (
    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Avatar initiale */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
            style={{
              background: `hsl(${((r.user_name?.charCodeAt(0) ?? 65) * 137) % 360}, 60%, 50%)`,
            }}
          >
            {(r.user_name?.[0] ?? "?").toUpperCase()}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-800 leading-tight">
              {r.user_name ?? "Anonyme"}
            </p>
            <p className="text-[11px] text-gray-400">
              {new Date(r.created_at).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Stars rating={r.rating} size="sm" />
          {r.is_verified_purchase && (
            <span
              className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100
                             px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap"
            >
              ✓ Achat vérifié
            </span>
          )}
        </div>
      </div>

      {r.title && (
        <p className="font-bold text-[13px] mb-0.5 text-gray-800">{r.title}</p>
      )}
      <p className="text-[13px] text-gray-600 leading-relaxed">{r.comment}</p>

      {/* Badge admin : ID de l'avis */}
      {isAdmin && (
        <p className="text-[10px] text-gray-300 mt-1 font-mono">id#{r.id}</p>
      )}
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function ProductReviews({ product }: Props) {
  const sectionRef = useRef<HTMLDivElement>(null);

  const user = useAppSelector(selectUser);
  const isAuth = useAppSelector(selectIsAuthenticated);
  const isAdmin = isAuth && user?.role === "ADMIN";

  // ── États admin ─────────────────────────────────────────────────────────────
  const [adminOpen, setAdminOpen] = useState(false);
  const [searchQuery, setSearch] = useState("");

  // ── Scroll vers #reviews ────────────────────────────────────────────────────
  useEffect(() => {
    if (window.location.hash === "#reviews" && sectionRef.current) {
      const t = setTimeout(() => {
        sectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
      return () => clearTimeout(t);
    }
  }, []);

  const reviews = product.reviews ?? [];
  const total = reviews.length;
  const avgRating =
    total > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;

  // Distribution par étoile
  const dist = useMemo(() => {
    const d: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) d[r.rating] = (d[r.rating] ?? 0) + 1;
    return d;
  }, [reviews]);

  // ── Filtrage admin ──────────────────────────────────────────────────────────
  const filteredReviews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((r) => r.user_name?.toLowerCase().includes(q));
  }, [reviews, searchQuery]);

  // ── Vue client : 5 premiers avis ───────────────────────────────────────────
  const CLIENT_LIMIT = 5;
  const displayedReviews = reviews.slice(0, CLIENT_LIMIT);
  const remainingReviews = total - displayedReviews.length;

  return (
    <div
      id="reviews"
      ref={sectionRef}
      className="mt-6 bg-white rounded-lg shadow-card p-5"
    >
      {/* ── En-tête ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-[18px] text-gray-900 flex items-center gap-2">
          <FiStar className="text-yellow-400" size={18} />
          Avis clients
          <span className="text-[15px] text-gray-400 font-normal">
            ({product.review_count ?? total})
          </span>
        </h2>

        {/* Bouton panneau admin */}
        {isAdmin && total > 0 && (
          <button
            onClick={() => setAdminOpen((v) => !v)}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-indigo-600
                       bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-full
                       px-3 py-1.5 transition-colors"
          >
            <FiShield size={12} />
            Vue admin
            {adminOpen ? (
              <FiChevronUp size={11} />
            ) : (
              <FiChevronDown size={11} />
            )}
          </button>
        )}
      </div>

      {/* ── Résumé statistiques (si au moins 3 avis) ── */}
      {total >= 3 && (
        <div className="flex gap-6 mb-5 pb-4 border-b border-gray-100">
          {/* Score global */}
          <div className="text-center flex-shrink-0">
            <p className="text-[42px] font-black text-gray-900 leading-none">
              {avgRating.toFixed(1)}
            </p>
            <Stars rating={avgRating} />
            <p className="text-[11px] text-gray-400 mt-1">{total} avis</p>
          </div>
          {/* Barres de répartition */}
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map((s) => (
              <RatingBar key={s} star={s} count={dist[s] ?? 0} total={total} />
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ── PANNEAU ADMIN (tous les avis + recherche) ──
          ══════════════════════════════════════════════════════ */}
      {isAdmin && adminOpen && (
        <div className="mb-6 border border-indigo-200 rounded-xl overflow-hidden">
          {/* Header panneau */}
          <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-3 flex items-center gap-3">
            <FiShield size={14} className="text-indigo-500" />
            <span className="text-[13px] font-bold text-indigo-700">
              Tous les avis ({total})
            </span>
            {/* Barre de recherche */}
            <div className="relative flex-1 max-w-xs ml-auto">
              <FiSearch
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom ou email..."
                className="w-full pl-8 pr-8 py-1.5 text-[12px] border border-indigo-200
                           bg-white rounded-lg focus:outline-none focus:border-indigo-400
                           focus:ring-1 focus:ring-indigo-300"
              />
              {searchQuery && (
                <button
                  title="Effacer la recherche"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <FiX size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Corps scrollable */}
          <div
            className="overflow-y-auto bg-white px-4 py-3 space-y-4"
            style={{ maxHeight: 420 }}
          >
            {filteredReviews.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <FiSearch size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-[13px]">
                  {searchQuery
                    ? `Aucun avis trouvé pour "${searchQuery}"`
                    : "Aucun avis."}
                </p>
              </div>
            ) : (
              <>
                {searchQuery && (
                  <p className="text-[11px] text-indigo-500 font-medium mb-2">
                    {filteredReviews.length} résultat
                    {filteredReviews.length > 1 ? "s" : ""} pour «{searchQuery}»
                  </p>
                )}
                {filteredReviews.map((r) => (
                  <ReviewCard key={r.id} r={r} isAdmin={true} />
                ))}
              </>
            )}
          </div>

          {/* Pied du panneau */}
          <div className="bg-gray-50 border-t border-indigo-100 px-4 py-2">
            <p className="text-[11px] text-gray-400">
              {filteredReviews.length} / {total} avis affichés
              {searchQuery ? ` · filtre : "${searchQuery}"` : ""}
            </p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ── VUE CLIENT (5 premiers avis) ──
          ══════════════════════════════════════════════════════ */}
      {total === 0 ? (
        <p className="text-[14px] text-gray-400 py-6 text-center">
          Aucun avis pour l'instant. Soyez le premier à donner votre avis !
        </p>
      ) : (
        <div className="space-y-4">
          {displayedReviews.map((r) => (
            <ReviewCard key={r.id} r={r} isAdmin={false} />
          ))}
          {remainingReviews > 0 && (
            <div className="text-center pt-2">
              <p className="text-[13px] text-gray-400 bg-gray-50 rounded-lg py-2">
                + {remainingReviews} autre{remainingReviews > 1 ? "s" : ""} avis
                {isAdmin
                  ? " — voir le panneau admin pour tous les afficher"
                  : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
