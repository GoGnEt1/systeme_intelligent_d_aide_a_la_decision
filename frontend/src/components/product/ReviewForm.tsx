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
import { FiCheck, FiStar } from "react-icons/fi";

interface Props {
  slug: string;
  reviews: Review[];
  onReviewAdded: (updatedProduct: Product) => void;
}

export default function ReviewForm({ slug, reviews, onReviewAdded }: Props) {
  const user = useAppSelector(selectUser);
  const isAuth = useAppSelector(selectIsAuthenticated);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Find user's existing review by matching user_name
  const existingReview: Review | null = user
    ? (reviews?.find(
        (r) =>
          r.user_name === `${user.first_name} ${user.last_name}`.trim() ||
          r.user_name === user.email,
      ) ?? null)
    : null;

  const existingRating = existingReview?.rating ?? 0;

  // showForm = true when:
  // - user has no existing review, OR
  // - user has existing review AND has clicked a strictly higher star
  const showForm = !existingReview || rating > existingRating;

  // showAlreadyMsg = user has existing review AND hasn't yet clicked a higher star
  const showAlreadyMsg = !!existingReview && rating <= existingRating;

  const handleStarClick = (star: number) => {
    // Always allow selecting any star; the submit handler validates
    setRating(star);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rating) {
      toast.error("Veuillez donner une note");
      return;
    }
    if (!comment.trim()) {
      toast.error("Veuillez écrire un commentaire");
      return;
    }
    if (existingReview && rating <= existingRating) {
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
        existingReview ? "Note améliorée ! Merci 🎉" : "Avis publié ! Merci 🎉",
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
      const status = e.response?.status;
      const body = e.response?.data;

      if (status === 409 || body?.error === "already_rated") {
        // Backend confirmed: rating not higher → show info toast only
        const existR = body?.existing_rating ?? existingRating;
        toast(
          `Vous avez déjà noté ce produit (${existR}/5). Choisissez une note supérieure pour améliorer.`,
          { icon: "ℹ️" },
        );
        setRating(existR); // reset to existing so showAlreadyMsg re-appears
      } else {
        toast.error(
          body?.message || body?.error || "Erreur lors de la publication",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoverRating || rating || existingRating;

  return (
    <div id="write-review" className="mt-4 pt-4 border-t border-gray-200">
      <h3 className="font-bold text-[16px] mb-3 text-gray-900">
        Laisser un avis
      </h3>

      {!isAuth ? (
        <p className="text-[14px] text-gray-500">
          <Link
            to="/login"
            className="text-blue-600 hover:underline font-medium"
          >
            Connectez-vous
          </Link>{" "}
          pour laisser un avis.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Already rated info banner */}
          {showAlreadyMsg && existingRating != 5 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <FiCheck className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-amber-800 text-[13px] font-semibold">
                  Vous avez déjà noté ce produit ({existingRating}/5)
                </p>
                <p className="text-amber-700 text-[12px] mt-0.5">
                  Vous pouvez améliorer votre note en choisissant une étoile
                  supérieure.
                </p>
              </div>
            </div>
          )}

          {/* Star selector — always visible when authenticated */}
          {/* <div className={`${existingReview && existingRating != 5 ? '':''} `}> */}
          <div>
            <label className="block text-[13px] font-semibold mb-2 text-gray-700">
              {existingReview ? "Améliorer votre note" : "Votre note"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const isActive = star <= displayRating;
                const isExisting = star <= existingRating;
                const isHigher = star > existingRating;
                let color = "text-gray-300";
                if (isActive) {
                  if (existingReview && isExisting) color = "text-orange-400";
                  else if (existingReview && isHigher && star <= displayRating)
                    color = "text-yellow-300";
                  else color = "text-orange-400";
                }
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => handleStarClick(star)}
                    className={`text-3xl transition-colors leading-none ${color}`}
                    title={`${star} étoile${star > 1 ? "s" : ""}`}
                  >
                    ★
                  </button>
                );
              })}
              {rating > 0 && (
                <span className="ml-2 text-[13px] text-gray-500 self-center">
                  {rating}/5
                  {existingReview && rating > existingRating && (
                    <span className="ml-1 text-emerald-600 font-semibold">
                      ↑ amélioration
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Form fields — only show when can submit */}
          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-3">
              {existingReview && rating > existingRating && (
                <p className="text-emerald-700 text-[12px] bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  ✓ Vous allez améliorer votre note de {existingRating}/5 à{" "}
                  {rating}/5
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
                    existingReview
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
                {existingReview ? "Améliorer mon avis" : "Publier mon avis"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
