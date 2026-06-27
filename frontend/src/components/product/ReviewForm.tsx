// src/components/product/ReviewForm.tsx
// ══════════════════════════════════════════════════════════════════════════════
// Règles métier :
//  • Un client = max 1 avis par produit
//  • Si note existante < 5 → peut améliorer uniquement si nouvelle note > ancienne
//  • Si note existante = 5 → message "vous avez déjà la note maximale", aucune action
//  • Survol étoile : impossible de survoler/sélectionner une note ≤ note existante
// ══════════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import toast from "react-hot-toast";
import api from "../../services/api";
import {
  selectUser,
  selectIsAuthenticated,
} from "../../store/slices/authSlice";
import { useAppSelector } from "../../hooks";
import type { Product, Review } from "../../types";
import Spinner from "../../components/common/Spinner";
import { Link } from "react-router-dom";
import { FiStar, FiLock, FiAward } from "react-icons/fi";

interface Props {
  slug: string;
  reviews: Review[];
  onReviewAdded: (updatedProduct: Product) => void;
}

// ── Composant étoile individuelle ─────────────────────────────────────────────
function Star({
  value,
  displayRating,
  existingRating,
  hasExisting,
  onHover,
  onLeave,
  onClick,
}: {
  value: number;
  displayRating: number;
  existingRating: number;
  hasExisting: boolean;
  onHover: (v: number) => void;
  onLeave: () => void;
  onClick: (v: number) => void;
}) {
  const isLocked = hasExisting && value <= existingRating; // ne peut pas sélectionner
  const isFilled = value <= displayRating;
  const isExist = value <= existingRating;
  const isImprove = hasExisting && value > existingRating && isFilled;

  // Couleur dynamique
  let color = "#D1D5DB"; // gris vide
  if (isFilled) {
    if (isImprove)
      color = "#FCD34D"; // jaune amélioration
    else if (isExist)
      color = "#F97316"; // orange existant
    else color = "#F97316"; // orange normal (sans existant)
  }

  return (
    <button
      key={value}
      type="button"
      disabled={isLocked}
      onMouseEnter={() => !isLocked && onHover(value)}
      onMouseLeave={onLeave}
      onClick={() => !isLocked && onClick(value)}
      aria-label={`${value} étoile${value > 1 ? "s" : ""}${isLocked ? " (verrouillée)" : ""}`}
      title={
        isLocked
          ? `Note ${value} déjà obtenue — choisissez une note supérieure à ${existingRating}`
          : `${value} étoile${value > 1 ? "s" : ""}`
      }
      style={{
        background: "none",
        border: "none",
        padding: "2px",
        cursor: isLocked ? "not-allowed" : "pointer",
        fontSize: 28,
        lineHeight: 1,
        color,
        transition: "color 0.1s, transform 0.1s",
        transform: !isLocked && isFilled ? "scale(1.15)" : "scale(1)",
        opacity: isLocked ? 0.45 : 1,
      }}
    >
      ★
    </button>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function ReviewForm({ slug, reviews, onReviewAdded }: Props) {
  const user = useAppSelector(selectUser);
  const isAuth = useAppSelector(selectIsAuthenticated);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // ── Trouver l'avis existant de cet utilisateur ────────────────────────────
  const existingReview: Review | null = user
    ? (reviews?.find((r) => {
        const fullName = `${user.first_name} ${user.last_name}`.trim();
        return (
          r.user_name === fullName ||
          r.user_name === user.email ||
          r.user_name === user.email?.split("@")[0]
        );
      }) ?? null)
    : null;

  const existingRating = existingReview?.rating ?? 0;
  const hasExisting = !!existingReview;
  const alreadyMaxed = hasExisting && existingRating >= 5;

  // ── États dérivés ─────────────────────────────────────────────────────────
  // Note affichée dans les étoiles (hover prioritaire, puis sélectionnée, puis existante)
  const displayRating = hoverRating || rating || existingRating;

  // Formulaire visible uniquement si : pas d'existant, OU note sélectionnée > existante
  const showForm = !hasExisting || (rating > existingRating && !alreadyMaxed);

  // ── Soumission ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rating) {
      toast.error("Veuillez sélectionner une note.");
      return;
    }
    if (!comment.trim()) {
      toast.error("Veuillez écrire un commentaire.");
      return;
    }
    if (hasExisting && rating <= existingRating) {
      toast(
        `Vous avez déjà noté ce produit (${existingRating}/5). Choisissez une note supérieure.`,
        { icon: "ℹ️" },
      );
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/products/${slug}/review/`, { rating, comment });
      toast.success(
        hasExisting ? "Note améliorée ! Merci 🎉" : "Avis publié ! Merci 🎉",
      );
      setRating(0);
      setComment("");
      const { data } = await api.get<Product>(`/products/${slug}/`);
      onReviewAdded(data);
    } catch (err: unknown) {
      const e = err as {
        response?: {
          status?: number;
          data?: { error?: string; message?: string; existing_rating?: number };
        };
      };
      const body = e.response?.data;

      if (e.response?.status === 409 || body?.error === "already_rated") {
        const existR = body?.existing_rating ?? existingRating;
        toast(
          `Vous avez déjà noté ce produit (${existR}/5). Choisissez une note supérieure.`,
          { icon: "ℹ️" },
        );
        setRating(existR);
      } else {
        toast.error(
          body?.message || body?.error || "Erreur lors de la publication.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div id="write-review" className="mt-4 pt-4 border-t border-gray-200">
      <h3 className="font-bold text-[16px] mb-3 text-gray-900">
        {hasExisting ? "Mon avis" : "Laisser un avis"}
      </h3>

      {/* ── Non connecté ── */}
      {!isAuth && (
        <p className="text-[14px] text-gray-500">
          <Link
            to="/login"
            className="text-blue-600 hover:underline font-medium"
          >
            Connectez-vous
          </Link>{" "}
          pour laisser un avis.
        </p>
      )}

      {/* ── Note maximale déjà atteinte ── */}
      {isAuth && alreadyMaxed && (
        <div
          className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50
                        border border-amber-200 rounded-xl px-4 py-3"
        >
          <FiAward size={20} className="text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-amber-800 text-[13px] font-bold">
              Vous avez déjà attribué la note maximale (5/5) ⭐
            </p>
            <p className="text-amber-600 text-[12px] mt-0.5">
              Impossible d'améliorer une note parfaite. Merci pour votre
              confiance !
            </p>
          </div>
          {/* Étoiles en lecture seule */}
          <div className="ml-auto flex gap-0.5 flex-shrink-0">
            {[1, 2, 3, 4, 5].map((v) => (
              <span key={v} style={{ color: "#F97316", fontSize: 18 }}>
                ★
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Formulaire principal ── */}
      {isAuth && !alreadyMaxed && (
        <div className="space-y-4">
          {/* Banner amélioration (note existante < 5, pas encore sélectionné mieux) */}
          {hasExisting && (rating === 0 || rating <= existingRating) && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <FiLock
                size={16}
                className="text-amber-600 mt-0.5 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-amber-800 text-[13px] font-semibold">
                  Vous avez déjà noté ce produit ({existingRating}/5)
                </p>
                <p className="text-amber-700 text-[12px] mt-0.5">
                  Vous pouvez améliorer uniquement si votre satisfaction a
                  augmenté. Cliquez sur une étoile{" "}
                  <strong>supérieure à {existingRating}</strong>.
                </p>
              </div>
              {/* Étoiles existantes en lecture seule */}
              <div className="flex gap-0.5 flex-shrink-0">
                {[1, 2, 3, 4, 5].map((v) => (
                  <span
                    key={v}
                    style={{
                      color: v <= existingRating ? "#F97316" : "#D1D5DB",
                      fontSize: 16,
                    }}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Sélecteur d'étoiles ── */}
          <div>
            <label className="block text-[13px] font-semibold mb-2 text-gray-700">
              {hasExisting
                ? `Améliorer votre note (actuellement ${existingRating}/5)`
                : "Votre note"}{" "}
              <span className="text-red-500">*</span>
              {hasExisting && (
                <span className="ml-2 text-[11px] text-gray-400 font-normal">
                  — seules les étoiles &gt; {existingRating} sont disponibles
                </span>
              )}
            </label>

            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((v) => (
                <Star
                  key={v}
                  value={v}
                  displayRating={displayRating}
                  existingRating={existingRating}
                  hasExisting={hasExisting}
                  onHover={setHoverRating}
                  onLeave={() => setHoverRating(0)}
                  onClick={setRating}
                />
              ))}

              {/* Label note sélectionnée */}
              {rating > 0 && (
                <span className="ml-2 text-[13px] text-gray-500 self-center select-none">
                  {rating}/5
                  {hasExisting && rating > existingRating && (
                    <span className="ml-1.5 text-emerald-600 font-bold text-[12px]">
                      ↑ +{rating - existingRating} point
                      {rating - existingRating > 1 ? "s" : ""}
                    </span>
                  )}
                </span>
              )}
              {rating === 0 && hoverRating > 0 && !hasExisting && (
                <span className="ml-2 text-[13px] text-gray-400 self-center select-none">
                  {hoverRating}/5
                </span>
              )}
            </div>
          </div>

          {/* ── Formulaire commentaire (visible si on peut soumettre) ── */}
          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Confirmation d'amélioration */}
              {hasExisting && rating > existingRating && (
                <p
                  className="text-emerald-700 text-[12px] bg-emerald-50 border border-emerald-200
                               rounded-lg px-3 py-2 flex items-center gap-2"
                >
                  <span className="text-emerald-500 font-bold">✓</span>
                  Vous allez améliorer votre note de{" "}
                  <strong>{existingRating}/5</strong> à{" "}
                  <strong>{rating}/5</strong>
                </p>
              )}

              <div>
                <label className="block text-[13px] font-semibold mb-1 text-gray-700">
                  Votre commentaire <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    hasExisting
                      ? "Expliquez pourquoi votre satisfaction a augmenté..."
                      : "Partagez votre expérience avec ce produit..."
                  }
                  rows={4}
                  className="input-field resize-none w-full"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting || rating === 0}
                className="btn-secondary px-6 py-2 rounded text-[14px] flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Spinner size="sm" /> : <FiStar size={14} />}
                {hasExisting ? "Améliorer mon avis" : "Publier mon avis"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
