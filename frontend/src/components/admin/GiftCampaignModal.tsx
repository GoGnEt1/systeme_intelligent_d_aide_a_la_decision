// src/components/admin/GiftCampaignModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Modal "Lancer la campagne" — Offres cadeaux CRM Sprint S4
// Utilisé dans SegmentationDashboard > CRMPanel
// Connecté à Redux mlSlice (createGiftOffer thunk)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback, memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "../../store";
import {
  createGiftOffer,
  fetchGifts,
  clearGiftError,
  selectGiftCreating,
  selectGiftError,
} from "../../store/slices/mlSlice";
import type { SegmentStat } from "../../store/slices/mlSlice";
import {
  FiX,
  FiMail,
  FiGift,
  FiSend,
  FiCheckCircle,
  FiAlertTriangle,
} from "react-icons/fi";

// ─── Types ────────────────────────────────────────────────────────────────────
interface GiftFormData {
  gift_type: "discount" | "product" | "shipping" | "points" | "voucher";
  gift_value: number;
  gift_details: string;
  valid_days: number;
  admin_note: string;
  target_mode: "segment_top" | "specific_user";
  user_id: string;
  top_n: number;
}

interface GiftCampaignModalProps {
  segment: SegmentStat;
  onClose: () => void;
}

const GIFT_TYPES = [
  {
    value: "discount",
    label: "Réduction (%)",
    icon: "🏷️",
    placeholder: "Ex: 20 (pour 20%)",
  },
  {
    value: "product",
    label: "Article gratuit",
    icon: "🎁",
    placeholder: "1 (article offert)",
  },
  {
    value: "shipping",
    label: "Livraison offerte",
    icon: "🚚",
    placeholder: "0 (livraison offerte)",
  },
  {
    value: "points",
    label: "Points fidélité",
    icon: "⭐",
    placeholder: "Ex: 500 points",
  },
  {
    value: "voucher",
    label: "Bon d'achat (DT)",
    icon: "💳",
    placeholder: "Ex: 50 (50 DT)",
  },
] as const;

// ─── Composant ────────────────────────────────────────────────────────────────
export const GiftCampaignModal = memo(function GiftCampaignModal({
  segment,
  onClose,
}: GiftCampaignModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const creating = useSelector(selectGiftCreating);
  const error = useSelector(selectGiftError);

  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const [form, setForm] = useState<GiftFormData>({
    gift_type: "discount",
    gift_value: 20,
    gift_details: `Réduction exclusive pour nos clients ${segment.segment_label} !`,
    valid_days: 7,
    admin_note: `Campagne segment ${segment.segment_label} — Q${Math.ceil(new Date().getMonth() / 3)} ${new Date().getFullYear()}`,
    target_mode: "segment_top",
    user_id: "",
    top_n: 10,
  });
  const [successData, setSuccessData] = useState<{
    email: string;
    status: string;
  } | null>(null);

  const selectedGiftType = GIFT_TYPES.find((g) => g.value === form.gift_type)!;

  const handleChange = useCallback(
    <K extends keyof GiftFormData>(key: K, value: GiftFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      if (error) dispatch(clearGiftError());
    },
    [error, dispatch],
  );

  const handleSubmit = useCallback(async () => {
    if (form.target_mode === "specific_user" && !form.user_id.trim()) return;
    setStep("confirm");
  }, [form]);

  const handleConfirm = useCallback(async () => {
    const payload = {
      user_id: form.user_id || "1", // En mode segment_top, on envoie au 1er (démo)
      gift_type: form.gift_type,
      gift_value: form.gift_value,
      gift_details: form.gift_details,
      valid_days: form.valid_days,
      admin_note: form.admin_note,
    };

    const result = await dispatch(createGiftOffer(payload));
    if (createGiftOffer.fulfilled.match(result)) {
      setSuccessData({
        email: result.payload.user_email,
        status: result.payload.status,
      });
      setStep("success");
      dispatch(fetchGifts(undefined));
    } else {
      setStep("form");
    }
  }, [dispatch, form]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header gradient */}
        <div
          className="flex items-center justify-between px-5 py-4 rounded-t-2xl"
          style={{
            background: `linear-gradient(135deg, ${segment.color}22 0%, ${segment.color}08 100%)`,
            borderBottom: `2px solid ${segment.color}30`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm"
              style={{
                backgroundColor: segment.color + "25",
                border: `1.5px solid ${segment.color}50`,
              }}
            >
              {segment.segment_label.split(" ")[0]}
            </div>
            <div>
              <h2 className="font-bold text-gognet-dark text-sm flex items-center gap-2">
                <FiGift size={14} className="text-gognet-orange" />
                Lancer une campagne cadeau
              </h2>
              <p className="text-xs text-gognet-gray">
                <span
                  className="font-semibold"
                  style={{ color: segment.color }}
                >
                  {segment.segment_label}
                </span>
                {" · "}
                {segment.n_clients} clients ·{" "}
                {segment.pct_revenue?.toFixed(1) ?? "—"}% du CA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Fermer"
            className="text-gognet-gray hover:text-gognet-dark p-1.5 rounded-lg hover:bg-black/10 transition-all"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* ── STEP: FORM ── */}
          {step === "form" && (
            <>
              {/* Info segment — carte colorée */}
              <div
                className="rounded-xl p-4 border"
                style={{
                  background: `linear-gradient(135deg, ${segment.color}10 0%, #fff 100%)`,
                  borderColor: segment.color + "40",
                }}
              >
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="bg-white/70 rounded-lg p-2 shadow-sm">
                    <p className="text-gray-500 text-[10px] uppercase tracking-wide">
                      Recency
                    </p>
                    <p className="font-bold text-gognet-dark mt-1 text-base">
                      {segment.recency_avg.toFixed(0)}
                      <span className="text-[10px] font-normal ml-0.5">j</span>
                    </p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-2 shadow-sm">
                    <p className="text-gray-500 text-[10px] uppercase tracking-wide">
                      Fréquence
                    </p>
                    <p className="font-bold text-gognet-dark mt-1 text-base">
                      {segment.frequency_avg.toFixed(1)}
                    </p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-2 shadow-sm">
                    <p className="text-gray-500 text-[10px] uppercase tracking-wide">
                      Panier moy.
                    </p>
                    <p className="font-bold text-gognet-dark mt-1 text-base">
                      {segment.monetary_avg.toFixed(0)}
                      <span className="text-[10px] font-normal ml-0.5">DT</span>
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-600 mt-3 bg-white/80 rounded-lg p-2 border border-white leading-relaxed">
                  💡 <strong>Action CRM recommandée :</strong>{" "}
                  {segment.action_crm}
                </p>
              </div>

              {/* Ciblage */}
              <div>
                <label className="block text-xs font-semibold text-gognet-dark mb-2">
                  Ciblage
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      value: "segment_top",
                      label: "Top N du segment",
                      desc: `Top ${form.top_n} clients par CA`,
                    },
                    {
                      value: "specific_user",
                      label: "Client spécifique",
                      desc: "Par ID utilisateur",
                    },
                  ].map(({ value, label, desc }) => (
                    <button
                      key={value}
                      onClick={() =>
                        handleChange(
                          "target_mode",
                          value as GiftFormData["target_mode"],
                        )
                      }
                      className={`p-3 rounded-xl border text-left transition-all text-xs ${form.target_mode === value ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-gray-200 hover:border-gray-300 text-gray-600"}`}
                    >
                      <p className="font-semibold">{label}</p>
                      <p className="text-[10px] mt-0.5 opacity-75">{desc}</p>
                    </button>
                  ))}
                </div>

                {form.target_mode === "segment_top" && (
                  <div className="mt-2">
                    <label className="block text-[11px] text-gognet-gray mb-1">
                      Nombre de clients
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      title="Top N clients"
                      value={form.top_n}
                      onChange={(e) =>
                        handleChange("top_n", parseInt(e.target.value) || 1)
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                  </div>
                )}
                {form.target_mode === "specific_user" && (
                  <div className="mt-2">
                    <label className="block text-[11px] text-gognet-gray mb-1">
                      ID utilisateur *
                    </label>
                    <input
                      type="text"
                      value={form.user_id}
                      placeholder="Ex: 42"
                      onChange={(e) => handleChange("user_id", e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                  </div>
                )}
              </div>

              {/* Type de cadeau */}
              <div>
                <label className="block text-xs font-semibold text-gognet-dark mb-2">
                  Type de cadeau
                </label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {GIFT_TYPES.map((gt) => (
                    <button
                      key={gt.value}
                      onClick={() => handleChange("gift_type", gt.value)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${form.gift_type === gt.value ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <p className="text-lg">{gt.icon}</p>
                      <p className="text-[9px] text-gray-600 mt-1 leading-tight">
                        {gt.label}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Valeur */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gognet-gray mb-1">
                    Valeur <span className="text-gognet-orange">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.gift_value}
                    placeholder={selectedGiftType.placeholder}
                    onChange={(e) =>
                      handleChange(
                        "gift_value",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gognet-gray mb-1">
                    Validité (jours)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    step={1}
                    title="Durée de validité en jours"
                    value={form.valid_days}
                    onChange={(e) =>
                      handleChange("valid_days", parseInt(e.target.value) || 7)
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
              </div>

              {/* Détails */}
              <div>
                <label className="block text-[11px] text-gognet-gray mb-1">
                  Message client <span className="text-gognet-orange">*</span>
                </label>
                <textarea
                  rows={2}
                  value={form.gift_details}
                  onChange={(e) => handleChange("gift_details", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
                  placeholder="Description de l'offre visible par le client..."
                />
              </div>

              {/* Note admin */}
              <div>
                <label className="block text-[11px] text-gognet-gray mb-1">
                  Note interne (admin)
                </label>
                <input
                  type="text"
                  value={form.admin_note}
                  onChange={(e) => handleChange("admin_note", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  placeholder="Contexte, trimestre, objectif..."
                />
              </div>

              {/* Aperçu email live */}
              {form.gift_details.trim() && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-100 px-3 py-1.5 flex items-center gap-2 border-b border-gray-200">
                    <FiMail size={11} className="text-gray-400" />
                    <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                      Aperçu email client
                    </span>
                    <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded font-semibold">
                      LIVE
                    </span>
                  </div>
                  <div className="bg-white p-3 space-y-2">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                      <div className="w-6 h-6 rounded-full bg-gognet-dark flex items-center justify-center text-[9px] font-bold text-gognet-orange">
                        S
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-gray-700">
                          SmartShop ML
                        </p>
                        <p className="text-[9px] text-gray-400">
                          Votre cadeau exclusif : {selectedGiftType.icon}{" "}
                          {form.gift_value}
                          {form.gift_type === "discount"
                            ? "%"
                            : form.gift_type === "voucher"
                              ? " DT"
                              : form.gift_type === "points"
                                ? " pts"
                                : ""}
                        </p>
                      </div>
                    </div>
                    <div
                      className="rounded-lg p-2.5 text-center"
                      style={{
                        background: `linear-gradient(135deg, #fff8e7, #fff3cd)`,
                        border: "1.5px solid #f59e0b40",
                      }}
                    >
                      <p className="text-lg">{selectedGiftType.icon}</p>
                      <p className="text-xs font-bold text-amber-700 mt-0.5">
                        {selectedGiftType.icon}{" "}
                        {form.gift_type === "discount"
                          ? `Réduction de ${form.gift_value}%`
                          : form.gift_type === "voucher"
                            ? `Bon d'achat de ${form.gift_value} DT`
                            : form.gift_type === "points"
                              ? `${form.gift_value} points fidélité`
                              : selectedGiftType.label}
                      </p>
                      <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">
                        {form.gift_details}
                      </p>
                      <p className="text-[9px] text-gray-400 mt-1.5">
                        ⏳ Valable {form.valid_days} jours
                      </p>
                    </div>
                    <div className="flex gap-1.5 justify-center pt-0.5">
                      <span className="text-[9px] bg-green-100 text-green-700 font-bold px-2 py-1 rounded">
                        ✅ Accepter
                      </span>
                      <span className="text-[9px] bg-gray-100 text-gray-500 px-2 py-1 rounded">
                        Non merci
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Erreur */}
              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600">
                  <FiAlertTriangle size={13} className="flex-shrink-0 mt-0.5" />{" "}
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={
                    !form.gift_details.trim() ||
                    (form.target_mode === "specific_user" &&
                      !form.user_id.trim())
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-b from-gognet-orange to-amber-500 text-white text-xs font-bold rounded-xl hover:from-amber-500 hover:to-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <FiSend size={13} /> Prévisualiser & Envoyer
                </button>
              </div>
            </>
          )}

          {/* ── STEP: CONFIRM ── */}
          {step === "confirm" && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="font-bold text-amber-800 text-sm mb-3">
                  Confirmer l'envoi de la campagne
                </p>

                <div className="space-y-2 text-xs text-amber-700">
                  <div className="flex justify-between">
                    <span className="text-amber-600">Segment cible</span>
                    <span className="font-semibold">
                      {segment.segment_label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-600">Nombre de clients</span>
                    <span className="font-semibold">
                      {form.target_mode === "specific_user"
                        ? "1 client"
                        : `Top ${form.top_n} clients`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-600">Type cadeau</span>
                    <span className="font-semibold">
                      {selectedGiftType.icon} {selectedGiftType.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-600">Valeur</span>
                    <span className="font-semibold">
                      {form.gift_value}{" "}
                      {form.gift_type === "discount"
                        ? "%"
                        : form.gift_type === "voucher" ||
                            form.gift_type === "points"
                          ? "DT/pts"
                          : ""}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-600">Validité</span>
                    <span className="font-semibold">
                      {form.valid_days} jours
                    </span>
                  </div>
                </div>

                <div className="mt-3 p-2.5 bg-white rounded-lg border border-amber-100">
                  <p className="text-[11px] text-amber-600 font-semibold mb-1">
                    Message client :
                  </p>
                  <p className="text-xs text-gray-700">{form.gift_details}</p>
                </div>

                <div className="flex items-center gap-2 mt-3 text-[11px] text-amber-600 bg-white/60 rounded-lg p-2">
                  <FiMail size={12} /> Un email sécurisé sera envoyé à chaque
                  client sélectionné.
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("form")}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-50 transition-all"
                >
                  ← Modifier
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={creating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-60 shadow-sm"
                >
                  {creating ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Envoi...
                    </>
                  ) : (
                    <>
                      <FiMail size={13} /> Envoyer la campagne
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: SUCCESS ── */}
          {step === "success" && successData && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <FiCheckCircle size={32} className="text-emerald-500" />
              </div>
              <div>
                <h3 className="font-bold text-gognet-dark text-base">
                  Campagne lancée !
                </h3>
                <p className="text-xs text-gognet-gray mt-1">
                  Email envoyé à <strong>{successData.email}</strong>
                </p>
                <p className="text-[11px] text-emerald-600 mt-1">
                  Statut : {successData.status}
                </p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700">
                Le client recevra un email avec un lien sécurisé pour accepter
                ou refuser l'offre. L'offre sera valable{" "}
                <strong>{form.valid_days} jours</strong>.
              </div>
              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 bg-gradient-to-b from-gognet-orange to-amber-500 text-white text-xs font-bold rounded-xl hover:from-amber-500 hover:to-amber-600 transition-all"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default GiftCampaignModal;
