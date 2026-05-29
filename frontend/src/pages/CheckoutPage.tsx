import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../hooks";
import { selectCart, resetCart } from "../store/slices/cartSlice";
import { selectUser } from "../store/slices/authSlice";
import api from "../services/api";
import toast from "react-hot-toast";
import type { CartItem, Address } from "../types/index";
import {
  FiMapPin,
  FiUser,
  FiPhone,
  FiMail,
  FiCheckCircle,
  FiTruck,
  FiSmartphone,
  FiCreditCard,
} from "react-icons/fi";

const SHIPPING_THRESHOLD = 300;
const SHIPPING_COST = 8;
const TVA_TIMBRE = 1;

type PaymentMethod = "COD" | "MOBILE" | "CARD";

interface ShippingForm {
  full_name: string;
  address_line: string;
  city: string;
  postal_code: string;
  phone: string;
  email: string;
  notes: string;
}

const PAYMENT_OPTIONS = [
  {
    id: "COD" as PaymentMethod,
    label: "Paiement à la livraison",
    desc: "Payez en espèces à la réception",
    icon: FiTruck,
  },
  {
    id: "MOBILE" as PaymentMethod,
    label: "Paiement mobile — i-Dinar",
    desc: "Entrez votre numéro de carte i-Dinar (ID17)",
    icon: FiSmartphone,
  },
  {
    id: "CARD" as PaymentMethod,
    label: "Carte bancaire",
    desc: "Visa / Mastercard (bientôt disponible)",
    icon: FiCreditCard,
    disabled: true,
  },
];

export default function CheckoutPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const { items, total } = useAppSelector(selectCart);

  const [step, setStep] = useState<"address" | "payment" | "confirm" | "done">(
    "address",
  );
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [idinarNumber, setIdinarNumber] = useState("");
  const [orderId, setOrderId] = useState("");

  // ── Adresses enregistrées ──────────────────────────────────
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<number | null>(null);
  const [addrLoading, setAddrLoading] = useState(true);

  const [form, setForm] = useState<ShippingForm>({
    full_name: user ? `${user.first_name} ${user.last_name}` : "",
    address_line: user?.address || "",
    city: user?.city || "",
    postal_code: user?.postal_code || "",
    phone: user?.phone || "",
    email: user?.email || "",
    notes: "",
  });

  // ── Chargement des adresses enregistrées au montage ────────
  useEffect(() => {
    api
      .get<Address[] | { results: Address[] }>("/auth/addresses/")
      .then(({ data }) => {
        const list: Address[] = Array.isArray(data)
          ? data
          : (data.results ?? []);
        setSavedAddresses(list);

        // Sélectionner l'adresse par défaut, ou la première disponible
        const defaultAddr = list.find((a) => a.is_default) ?? list[0] ?? null;
        if (defaultAddr) {
          setSelectedAddrId(defaultAddr.id);
          // Pré-remplir le formulaire avec ses données
          setForm((f) => ({
            ...f,
            full_name: defaultAddr.full_name,
            address_line: defaultAddr.address_line,
            city: defaultAddr.city,
            postal_code: defaultAddr.postal_code,
            phone: defaultAddr.phone,
          }));
        }
      })
      .catch(() => {
        // Pas d'adresses ou non connecté → garder les valeurs user par défaut
      })
      .finally(() => setAddrLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Quand l'user sélectionne une adresse du carnet ─────────
  const handleSelectSavedAddr = (addr: Address) => {
    setSelectedAddrId(addr.id);
    setForm((f) => ({
      ...f,
      full_name: addr.full_name,
      address_line: addr.address_line,
      city: addr.city,
      postal_code: addr.postal_code,
      phone: addr.phone,
    }));
  };

  // ── Montants ───────────────────────────────────────────────
  const subtotal = typeof total === "string" ? parseFloat(total) : total;
  const shippingCost = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const grandTotal = subtotal + shippingCost + TVA_TIMBRE;

  const set =
    (k: keyof ShippingForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const validateIdinar = (v: string) => /^\d{17}$/.test(v.trim());

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === "address") {
      setStep("payment");
      return;
    }
    if (step === "payment") {
      if (paymentMethod === "MOBILE" && !validateIdinar(idinarNumber)) {
        toast.error("Le numéro i-Dinar doit contenir exactement 17 chiffres.");
        return;
      }
      setStep("confirm");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/orders/", {
        // Si une adresse du carnet est sélectionnée, envoyer son ID
        // Sinon envoyer les infos manuelles
        ...(selectedAddrId
          ? { shipping_address_id: selectedAddrId }
          : {
              shipping_info: {
                full_name: form.full_name,
                address_line: form.address_line,
                city: form.city,
                postal_code: form.postal_code,
                phone: form.phone,
              },
            }),
        notes: form.notes,
        payment_method: paymentMethod,
        idinar_number: paymentMethod === "MOBILE" ? idinarNumber.trim() : "",
      });

      dispatch(resetCart());
      setOrderId(data.order_number);
      setStep("done");
      toast.success("Commande passée avec succès ! 🎉");
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { error?: string; errors?: string[] } };
      };
      toast.error(
        e.response?.data?.error ||
          e.response?.data?.errors?.[0] ||
          "Erreur lors de la commande",
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Écran "done" ──────────────────────────────────────────
  if (step === "done")
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <FiCheckCircle className="text-7xl text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Commande confirmée !
        </h1>
        <p className="text-gray-500 mb-2">
          N° de commande : <strong>{orderId}</strong>
        </p>
        {/* <p className="text-[13px] text-gray-400 mb-6">
          Un email de confirmation a été envoyé à <strong>{form.email}</strong>
        </p> */}
        <div className="flex gap-3 justify-center">
          <Link to="/orders">
            <button className="btn-secondary px-6 py-2 rounded">
              Mes commandes
            </button>
          </Link>
          <Link to="/products">
            <button className="btn-primary px-6 py-2 rounded">
              Continuer les achats
            </button>
          </Link>
        </div>
      </div>
    );

  const steps = [
    { key: "address", label: "Adresse" },
    { key: "payment", label: "Paiement" },
    { key: "confirm", label: "Confirmation" },
  ];
  const currentStep = steps.findIndex((s) => s.key === step);

  return (
    <div className="max-w-5xl mx-auto px-4 py-4">
      {/* Barre d'étapes */}
      <div className="flex items-center gap-2 mb-6 text-[13px]">
        {steps.map((s, i) => (
          <span key={s.key} className="flex items-center gap-1">
            <span
              className={`${i < currentStep ? "text-green-600" : i === currentStep ? "text-gognet-orange font-bold" : "text-gray-400"}`}
            >
              {i < currentStep ? "✓" : `${i + 1}.`} {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="text-gray-300 mx-1">──</span>
            )}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
        <div className="bg-white rounded-lg shadow-card p-6">
          <form onSubmit={handleOrder} className="space-y-4">
            {/* ── Étape 1 : Adresse ── */}
            {step === "address" && (
              <>
                <h2 className="font-bold text-[17px] mb-4 flex items-center gap-2">
                  <FiMapPin className="text-gognet-orange" /> Adresse de
                  livraison
                </h2>

                {/* Sélecteur adresses enregistrées */}
                {!addrLoading && savedAddresses.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[13px] font-semibold text-gray-600 mb-2">
                      Mes adresses enregistrées
                    </p>
                    <div className="space-y-2">
                      {savedAddresses.map((addr) => (
                        <label
                          key={addr.id}
                          className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer
                            transition-all text-[13px]
                            ${
                              selectedAddrId === addr.id
                                ? "border-gognet-orange bg-orange-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                        >
                          <input
                            type="radio"
                            name="savedAddr"
                            checked={selectedAddrId === addr.id}
                            onChange={() => handleSelectSavedAddr(addr)}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <p className="font-medium">
                              {addr.label}
                              {addr.is_default && (
                                <span className="ml-2 text-[11px] bg-gognet-orange text-white px-1.5 py-0.5 rounded">
                                  Par défaut
                                </span>
                              )}
                            </p>
                            <p className="text-gray-600">
                              {addr.full_name} · {addr.phone}
                            </p>
                            <p className="text-gray-500">
                              {addr.address_line}, {addr.postal_code}{" "}
                              {addr.city}
                            </p>
                          </div>
                        </label>
                      ))}
                      {/* Option : saisir une nouvelle adresse */}
                      <label
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer
                          transition-all text-[13px]
                          ${
                            selectedAddrId === null
                              ? "border-gognet-orange bg-orange-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                      >
                        <input
                          type="radio"
                          name="savedAddr"
                          checked={selectedAddrId === null}
                          onChange={() => setSelectedAddrId(null)}
                          className="mt-0.5"
                        />
                        <span className="text-gray-600">
                          + Utiliser une nouvelle adresse
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Formulaire manuel (si nouvelle adresse ou aucune enregistrée) */}
                {(selectedAddrId === null || savedAddresses.length === 0) && (
                  <div className="space-y-3">
                    {[
                      {
                        key: "full_name",
                        label: "Nom complet *",
                        type: "text",
                        icon: <FiUser />,
                        placeholder: "Ahmed Ben Ali",
                      },
                      {
                        key: "phone",
                        label: "Téléphone *",
                        type: "tel",
                        icon: <FiPhone />,
                        placeholder: "+216 XX XXX XXX",
                      },
                      {
                        key: "email",
                        label: "Email *",
                        type: "email",
                        icon: <FiMail />,
                        placeholder: "email@exemple.com",
                        full: true,
                      },
                      {
                        key: "city",
                        label: "Ville *",
                        type: "text",
                        icon: null,
                        placeholder: "Tunis",
                      },
                      {
                        key: "postal_code",
                        label: "Code postal *",
                        type: "text",
                        icon: null,
                        placeholder: "1000",
                      },
                    ].map((f: any) => (
                      <div
                        key={f.key}
                        className={f.full ? "sm:col-span-2" : ""}
                      >
                        <label className="block text-[13px] font-bold mb-1">
                          {f.label}
                        </label>
                        <div className="relative">
                          {f.icon && (
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                              {f.icon}
                            </span>
                          )}
                          <input
                            type={f.type}
                            value={(form as any)[f.key]}
                            onChange={set(f.key as keyof ShippingForm)}
                            placeholder={f.placeholder}
                            required
                            className={`input-field ${f.icon ? "pl-9" : ""}`}
                          />
                        </div>
                      </div>
                    ))}
                    <div>
                      <label className="block text-[13px] font-bold mb-1">
                        Adresse complète <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.address_line}
                        onChange={set("address_line")}
                        placeholder="N° rue, quartier, avenue..."
                        required
                        className="input-field"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[13px] font-bold mb-1">
                    Notes (optionnel)
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={set("notes")}
                    placeholder="Instructions de livraison..."
                    rows={2}
                    className="input-field resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="btn-secondary w-full py-3 text-[14px] rounded"
                >
                  Continuer →
                </button>
              </>
            )}

            {/* ── Étape 2 : Paiement ── */}
            {step === "payment" && (
              <>
                <h2 className="font-bold text-[17px] mb-4">Mode de paiement</h2>
                <div className="space-y-3">
                  {PAYMENT_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all
                          ${(opt as any).disabled ? "opacity-40 cursor-not-allowed" : ""}
                          ${paymentMethod === opt.id ? "border-gognet-orange bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
                      >
                        <input
                          type="radio"
                          name="payment"
                          value={opt.id}
                          disabled={(opt as any).disabled}
                          checked={paymentMethod === opt.id}
                          onChange={() =>
                            !(opt as any).disabled && setPaymentMethod(opt.id)
                          }
                          className="mt-1"
                        />
                        <Icon className="text-xl mt-0.5 text-gray-600" />
                        <div>
                          <p className="font-semibold text-[14px]">
                            {opt.label}
                          </p>
                          <p className="text-[12px] text-gray-500">
                            {opt.desc}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {paymentMethod === "MOBILE" && (
                  <div className="mt-4">
                    <label className="block text-[13px] font-bold mb-1">
                      Numéro de carte i-Dinar (ID17) *
                    </label>
                    <input
                      type="text"
                      maxLength={17}
                      value={idinarNumber}
                      onChange={(e) =>
                        setIdinarNumber(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="17 chiffres"
                      className={`input-field font-mono tracking-widest ${
                        idinarNumber.length > 0 && !validateIdinar(idinarNumber)
                          ? "border-red-400"
                          : ""
                      }`}
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      {idinarNumber.length}/17 chiffres
                      {idinarNumber.length > 0 &&
                        !validateIdinar(idinarNumber) && (
                          <span className="text-red-500 ml-2">⚠ Incomplet</span>
                        )}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setStep("address")}
                    className="w-1/3 py-3 text-[13px] text-gognet-blue hover:underline"
                  >
                    ← Retour
                  </button>
                  <button
                    type="submit"
                    className="btn-secondary flex-1 py-3 text-[14px] rounded"
                  >
                    Continuer →
                  </button>
                </div>
              </>
            )}

            {/* ── Étape 3 : Confirmation ── */}
            {step === "confirm" && (
              <>
                <h2 className="font-bold text-[17px] mb-4">
                  Confirmer la commande
                </h2>

                <div className="bg-gray-50 rounded-lg p-4 text-[13px] space-y-0.5 mb-4">
                  <p className="font-bold text-gray-700 mb-1">Livraison à :</p>
                  {selectedAddrId ? (
                    (() => {
                      const a = savedAddresses.find(
                        (x) => x.id === selectedAddrId,
                      )!;
                      return (
                        <>
                          <p className="font-medium">
                            {a.full_name} · {a.phone}
                          </p>
                          <p className="text-gray-600">
                            {a.address_line}, {a.postal_code} {a.city}
                          </p>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <p className="font-medium">
                        {form.full_name} · {form.phone}
                      </p>
                      <p className="text-gray-600">
                        {form.address_line}, {form.postal_code} {form.city}
                      </p>
                    </>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4 text-[13px] mb-4">
                  <p className="font-bold text-gray-700 mb-1">💳 Paiement :</p>
                  <p>
                    {PAYMENT_OPTIONS.find((o) => o.id === paymentMethod)?.label}
                  </p>
                  {paymentMethod === "MOBILE" && (
                    <p className="text-gray-500 font-mono">
                      ···{idinarNumber.slice(-4)}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 mb-4">
                  {items.map((item: CartItem) => {
                    const sub =
                      typeof item.subtotal === "string"
                        ? parseFloat(item.subtotal)
                        : item.subtotal;
                    return (
                      <div
                        key={item.id}
                        className="flex justify-between text-[13px] border-b pb-1"
                      >
                        <span className="text-gray-700 flex-1 pr-2">
                          {item.product_name} × {item.quantity}
                        </span>
                        <span className="font-bold">{sub.toFixed(2)} DT</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("payment")}
                    className="w-1/3 py-3 text-[13px] text-gognet-blue hover:underline"
                  >
                    ← Retour
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-secondary flex-1 py-3 text-[14px] rounded flex items-center justify-center gap-2"
                  >
                    {loading && (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    {loading ? "Traitement..." : "✓ Confirmer la commande"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>

        {/* Récapitulatif sticky */}
        <div className="bg-white rounded-lg shadow-card p-5 h-fit sticky top-20">
          <h3 className="font-bold text-[15px] border-b pb-3 mb-3">
            Récapitulatif
          </h3>
          <div className="space-y-1.5 mb-4">
            {items.map((item: CartItem) => {
              const sub =
                typeof item.subtotal === "string"
                  ? parseFloat(item.subtotal)
                  : item.subtotal;
              return (
                <div key={item.id} className="flex justify-between text-[12px]">
                  <span className="text-gray-600 flex-1 pr-2 line-clamp-1">
                    {item.product_name} ×{item.quantity}
                  </span>
                  <span className="font-medium">{sub.toFixed(2)} DT</span>
                </div>
              );
            })}
          </div>
          <div className="border-t pt-3 space-y-1.5 text-[13px]">
            <div className="flex justify-between text-gray-600">
              <span>Sous-total</span>
              <span>{subtotal.toFixed(2)} DT</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Livraison</span>
              <span
                className={
                  shippingCost === 0 ? "text-green-600 font-medium" : ""
                }
              >
                {shippingCost === 0
                  ? "Gratuit"
                  : `${SHIPPING_COST.toFixed(2)} DT`}
              </span>
            </div>
            {shippingCost > 0 && (
              <p className="text-[11px] text-gray-400">
                Encore {(SHIPPING_THRESHOLD - subtotal).toFixed(2)} DT pour la
                livraison gratuite
              </p>
            )}
            <div className="flex justify-between text-gray-600">
              <span>TVA / Timbre</span>
              <span>{TVA_TIMBRE.toFixed(2)} DT</span>
            </div>
            <div className="flex justify-between font-bold text-[16px] border-t pt-2">
              <span>Total TTC</span>
              <span className="text-gognet-red">
                {grandTotal.toFixed(2)} DT
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
