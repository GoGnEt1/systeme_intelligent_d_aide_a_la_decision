import { useState, useEffect } from "react";
import { useAppSelector } from "../hooks";
import { selectUser } from "../store/slices/authSlice";
import api from "../services/api";
import toast from "react-hot-toast";
import {
  FiUser,
  FiMail,
  FiPhone,
  FiMapPin,
  FiEdit3,
  FiSave,
  FiLock,
  FiPlus,
  FiTrash2,
  FiCheck,
  FiStar,
} from "react-icons/fi";
import type { Address } from "../types";

type Tab = "info" | "addresses" | "security";

const TUNISIAN_CITIES = [
  "Tunis",
  "Sfax",
  "Sousse",
  "Kairouan",
  "Bizerte",
  "Gabès",
  "Ariana",
  "Gafsa",
  "Monastir",
  "Ben Arous",
  "Kasserine",
  "Médenine",
  "Nabeul",
  "Tataouine",
  "Béja",
  "Jendouba",
  "El Kef",
  "Mahdia",
  "Sidi Bouzid",
  "Tozeur",
  "Siliana",
  "Zaghouan",
  "Kebili",
  "Manouba",
];

export default function ProfilePage() {
  const user = useAppSelector(selectUser);
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Formulaire profil ──────────────────────────────────────
  const [form, setForm] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    phone: user?.phone || "",
    city: user?.city || "",
    address: user?.address || "",
  });

  // ── Adresses ──────────────────────────────────────────────
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [newAddr, setNewAddr] = useState({
    label: "Domicile",
    full_name: user ? `${user.first_name} ${user.last_name}` : "",
    phone: user?.phone || "",
    address_line: "",
    city: "",
    postal_code: "",
    country: "Tunisie",
    is_default: false,
  });

  // ── Mot de passe ──────────────────────────────────────────
  const [pwdForm, setPwdForm] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [pwdLoading, setPwdLoading] = useState(false);

  // ── Chargement initial : adresse par défaut → profil ──────
  // On fait cet appel une seule fois au montage pour pré-remplir
  // le formulaire avec l'adresse par défaut du carnet.
  useEffect(() => {
    api
      .get<Address[] | { results: Address[] }>("/auth/addresses/")
      .then(({ data }) => {
        const list: Address[] = Array.isArray(data)
          ? data
          : (data.results ?? []);
        setAddresses(list);

        // Trouver l'adresse par défaut (ou la plus récente si aucune par défaut)
        const defaultAddr = list.find((a) => a.is_default) ?? list[0] ?? null;
        if (defaultAddr) {
          // Pré-remplir le formulaire info avec les données du carnet
          setForm((f) => ({
            ...f,
            city: defaultAddr.city || f.city,
            address: defaultAddr.address_line || f.address,
            phone: defaultAddr.phone || f.phone,
          }));
        }
      })
      .catch(() => {
        // Pas d'adresses ou erreur → garder les valeurs user par défaut
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAddresses = () => {
    setAddrLoading(true);
    api
      .get<Address[] | { results: Address[] }>("/auth/addresses/")
      .then(({ data }) => {
        const list: Address[] = Array.isArray(data)
          ? data
          : (data.results ?? []);
        setAddresses(list);
      })
      .catch(() => toast.error("Erreur chargement adresses"))
      .finally(() => setAddrLoading(false));
  };

  // Recharger les adresses quand on change d'onglet
  useEffect(() => {
    if (activeTab === "addresses") loadAddresses();
  }, [activeTab]);

  // ── Save profil ───────────────────────────────────────────
  const handleSave = async () => {
    setLoading(true);
    try {
      await api.patch("/auth/profile/", form);
      toast.success("Profil mis à jour !");
      setEditing(false);
    } catch {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  // ── Ajouter adresse ───────────────────────────────────────
  const handleAddAddress = async () => {
    if (
      !newAddr.full_name ||
      !newAddr.phone ||
      !newAddr.address_line ||
      !newAddr.city ||
      !newAddr.postal_code
    ) {
      toast.error("Tous les champs * sont requis.");
      return;
    }
    try {
      await api.post("/auth/addresses/", { ...newAddr, country: "Tunisie" });
      toast.success("Adresse ajoutée !");
      setShowAddrForm(false);
      setNewAddr({
        label: "Domicile",
        full_name: user ? `${user.first_name} ${user.last_name}` : "",
        phone: user?.phone || "",
        address_line: "",
        city: "",
        postal_code: "",
        country: "Tunisie",
        is_default: false,
      });
      loadAddresses();
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, string[]> } };
      if (e.response?.data) {
        Object.values(e.response.data).forEach((msgs) => toast.error(msgs[0]));
      } else {
        toast.error("Erreur lors de l'ajout");
      }
    }
  };

  const handleDeleteAddress = async (id: number) => {
    try {
      await api.delete(`/auth/addresses/${id}/`);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      toast.success("Adresse supprimée");
    } catch {
      toast.error("Erreur suppression");
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await api.patch(`/auth/addresses/${id}/`, { is_default: true });
      // Mettre à jour localement sans re-fetch
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, is_default: a.id === id })),
      );
      toast.success("Adresse par défaut mise à jour");
    } catch {
      toast.error("Erreur");
    }
  };

  // ── Changer mot de passe ──────────────────────────────────
  const handleChangePassword = async () => {
    if (pwdForm.new_password !== pwdForm.confirm_password) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    if (pwdForm.new_password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setPwdLoading(true);
    try {
      await api.post("/auth/change-password/", pwdForm);
      toast.success("Mot de passe modifié !");
      setPwdForm({ old_password: "", new_password: "", confirm_password: "" });
    } catch (err: unknown) {
      // Afficher les erreurs champ par champ si présentes
      const e = err as {
        response?: { data?: Record<string, string | string[]> };
      };
      if (e.response?.data) {
        const data = e.response.data;
        const msg =
          data.old_password?.[0] ||
          data.new_password?.[0] ||
          data.confirm_password?.[0] ||
          data.non_field_errors?.[0] ||
          "Erreur lors de la modification";
        toast.error(String(msg));
      } else {
        toast.error("Erreur lors de la modification");
      }
    } finally {
      setPwdLoading(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "info", label: "Informations", icon: <FiUser size={14} /> },
    { key: "addresses", label: "Adresses", icon: <FiMapPin size={14} /> },
    { key: "security", label: "Sécurité", icon: <FiLock size={14} /> },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow-card overflow-hidden">
        {/* Header */}
        <div className="bg-gognet-dark px-6 py-6 flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full bg-gognet-orange flex items-center justify-center
                          text-2xl font-black text-gognet-dark"
          >
            {user?.first_name?.[0]?.toUpperCase()}
            {user?.last_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-white font-bold text-xl">
              {user?.first_name} {user?.last_name}
            </h1>
            <p className="text-gray-400 text-[13px] flex items-center gap-1">
              <FiMail className="text-[11px]" /> {user?.email}
            </p>
            {user?.rfm_segment && (
              <span
                className="mt-1 inline-block text-[11px] bg-gognet-orange/20 text-gognet-orange
                               border border-gognet-orange/30 px-2 py-0.5 rounded-full"
              >
                🏷️ Segment ML: {user.rfm_segment}
              </span>
            )}
          </div>
        </div>

        {/* Onglets */}
        <div className="flex border-b">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-5 py-3 text-[13px] font-medium
                transition-colors border-b-2 -mb-px
                ${
                  activeTab === t.key
                    ? "border-gognet-orange text-gognet-orange"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ── Onglet Informations ── */}
          {activeTab === "info" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-bold text-[15px]">
                  Informations personnelles
                </h2>
                <button
                  onClick={() => setEditing((v) => !v)}
                  className="flex items-center gap-1 text-[13px] text-gognet-blue hover:underline"
                >
                  <FiEdit3 size={13} /> {editing ? "Annuler" : "Modifier"}
                </button>
              </div>

              {[
                { key: "email", label: "Adresse e-mail", icon: <FiMail /> },
                { key: "first_name", label: "Prénom", icon: <FiUser /> },
                { key: "last_name", label: "Nom", icon: <FiUser /> },
                {
                  key: "phone",
                  label: "Téléphone",
                  icon: <FiPhone />,
                  hint: "+216 XX XXX XXX",
                },
                {
                  key: "city",
                  label: "Ville",
                  icon: <FiMapPin />,
                  isList: true,
                },
                { key: "address", label: "Adresse", icon: <FiMapPin /> },
              ].map((f: any) => (
                <div key={f.key}>
                  <label className="text-[12px] text-gray-500 mb-1 flex items-center gap-1">
                    <span className="text-gognet-orange">{f.icon}</span>{" "}
                    {f.label}
                  </label>
                  {editing ? (
                    <>
                      <input
                        type="text"
                        list={f.isList ? "tunisian-cities" : undefined}
                        value={
                          f.key === "email"
                            ? user?.email || ""
                            : (form as any)[f.key]
                        }
                        onChange={(e) =>
                          setForm((p) => ({ ...p, [f.key]: e.target.value }))
                        }
                        placeholder={f.hint || ""}
                        className="input-field"
                      />
                      {f.hint && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {f.hint}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-[14px] text-gray-800 font-medium">
                      {f.key === "email"
                        ? user?.email || ""
                        : (form as any)[f.key] || (
                            <span className="text-gray-400 italic">
                              Non renseigné
                            </span>
                          )}
                    </p>
                  )}
                </div>
              ))}

              <datalist id="tunisian-cities">
                {TUNISIAN_CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>

              {editing && (
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="btn-secondary flex items-center gap-2 px-6 py-2 rounded"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FiSave />
                  )}
                  Enregistrer
                </button>
              )}
            </div>
          )}

          {/* ── Onglet Adresses ── */}
          {activeTab === "addresses" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-[15px]">
                  Carnet d&apos;adresses
                </h2>
                <button
                  onClick={() => setShowAddrForm((v) => !v)}
                  className="flex items-center gap-1 text-[13px] bg-gognet-orange/10
                             text-gognet-orange hover:bg-gognet-orange/20 px-3 py-1.5 rounded"
                >
                  <FiPlus size={13} /> Ajouter
                </button>
              </div>

              {addrLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-gognet-orange border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    {addresses.length === 0 && !showAddrForm && (
                      <p className="text-[13px] text-gray-400 italic text-center py-6">
                        Aucune adresse enregistrée
                      </p>
                    )}
                    {addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className={`rounded-lg border p-4 text-[13px] relative
                          ${addr.is_default ? "border-gognet-orange bg-orange-50" : "border-gray-200"}`}
                      >
                        {addr.is_default && (
                          <span
                            className="absolute top-2 right-2 text-[11px] bg-gognet-orange
                                           text-white px-2 py-0.5 rounded-full flex items-center gap-1"
                          >
                            <FiStar size={10} /> Par défaut
                          </span>
                        )}
                        <p className="font-semibold text-gray-800">
                          {addr.label}
                        </p>
                        <p className="text-gray-700">
                          {addr.full_name} · {addr.phone}
                        </p>
                        <p className="text-gray-500">{addr.address_line}</p>
                        <p className="text-gray-500">
                          {addr.postal_code} {addr.city}, {addr.country}
                        </p>
                        <div className="flex gap-3 mt-2">
                          {!addr.is_default && (
                            <button
                              onClick={() => handleSetDefault(addr.id)}
                              className="text-[12px] text-gognet-blue hover:underline flex items-center gap-1"
                            >
                              <FiCheck size={11} /> Définir par défaut
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="text-[12px] text-red-400 hover:text-red-600 flex items-center gap-1"
                          >
                            <FiTrash2 size={11} /> Supprimer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {showAddrForm && (
                    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <h3 className="font-semibold text-[14px] text-gray-700">
                        Nouvelle adresse
                      </h3>
                      <p className="text-[11px] text-blue-600 bg-blue-50 px-3 py-2 rounded">
                        🌍 SmartShop livre uniquement en{" "}
                        <strong>Tunisie</strong>
                      </p>
                      {[
                        {
                          key: "label",
                          label: "Étiquette",
                          placeholder: "Domicile, Bureau...",
                        },
                        {
                          key: "full_name",
                          label: "Nom complet",
                          placeholder: "Ahmed Ben Ali",
                        },
                        {
                          key: "phone",
                          label: "Téléphone",
                          placeholder: "+216 XX XXX XXX",
                        },
                        {
                          key: "address_line",
                          label: "Adresse complète",
                          placeholder: "N° rue, quartier...",
                        },
                        {
                          key: "postal_code",
                          label: "Code postal",
                          placeholder: "4 chiffres (ex: 1000)",
                        },
                      ].map((f) => (
                        <div key={f.key}>
                          <label className="block text-[12px] font-medium text-gray-600 mb-1">
                            {f.label} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={(newAddr as any)[f.key]}
                            onChange={(e) =>
                              setNewAddr((p) => ({
                                ...p,
                                [f.key]: e.target.value,
                              }))
                            }
                            placeholder={f.placeholder}
                            className="input-field"
                          />
                        </div>
                      ))}
                      <div>
                        <label className="block text-[12px] font-medium text-gray-600 mb-1">
                          Ville <span className="text-red-500">*</span>
                        </label>
                        <input
                          list="tunisian-cities-addr"
                          value={newAddr.city}
                          onChange={(e) =>
                            setNewAddr((p) => ({ ...p, city: e.target.value }))
                          }
                          placeholder="Tunis, Sfax..."
                          className="input-field"
                        />
                        <datalist id="tunisian-cities-addr">
                          {TUNISIAN_CITIES.map((c) => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </div>
                      <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newAddr.is_default}
                          onChange={(e) =>
                            setNewAddr((p) => ({
                              ...p,
                              is_default: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 accent-gognet-orange"
                        />
                        Définir comme adresse par défaut
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddAddress}
                          className="btn-secondary px-4 py-2 rounded text-[13px] flex items-center gap-1"
                        >
                          <FiSave size={13} /> Enregistrer
                        </button>
                        <button
                          onClick={() => setShowAddrForm(false)}
                          className="px-4 py-2 rounded text-[13px] text-gray-500 hover:bg-gray-100"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Onglet Sécurité ── */}
          {activeTab === "security" && (
            <div className="space-y-4">
              <h2 className="font-bold text-[15px] mb-2">
                Changer le mot de passe
              </h2>
              {[
                {
                  key: "old_password",
                  label: "Mot de passe actuel",
                  placeholder: "Votre mot de passe actuel",
                },
                {
                  key: "new_password",
                  label: "Nouveau mot de passe",
                  placeholder: "Min. 8 caractères",
                },
                {
                  key: "confirm_password",
                  label: "Confirmer le nouveau",
                  placeholder: "Répéter le nouveau mot de passe",
                },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-[13px] font-semibold mb-1">
                    {f.label} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={(pwdForm as any)[f.key]}
                    onChange={(e) =>
                      setPwdForm((p) => ({ ...p, [f.key]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                    className="input-field"
                  />
                </div>
              ))}
              <button
                onClick={handleChangePassword}
                disabled={pwdLoading}
                className="btn-secondary flex items-center gap-2 px-6 py-2 rounded disabled:opacity-60"
              >
                {pwdLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FiLock size={14} />
                )}
                Modifier le mot de passe
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
