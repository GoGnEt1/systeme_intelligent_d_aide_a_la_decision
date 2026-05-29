// src/pages/RegisterPage.tsx
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../hooks/index";
import {
  registerUser,
  selectIsAuthenticated,
  selectAuthLoading,
  selectAuthError,
  clearError,
} from "../store/slices/authSlice";
import toast from "react-hot-toast";
import {
  FiMail,
  FiLock,
  FiUser,
  FiPhone,
  FiEye,
  FiEyeOff,
} from "react-icons/fi";

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isAuth = useAppSelector(selectIsAuthenticated);
  const loading = useAppSelector(selectAuthLoading);
  const error = useAppSelector(selectAuthError);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    password2: "",
  });
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    if (isAuth) navigate("/");
    return () => {
      dispatch(clearError());
    };
  }, [isAuth]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.password2) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    try {
      await dispatch(registerUser(form)).unwrap();
      toast.success("Compte créé avec succès ! Bienvenue 🎉");
    } catch (err: unknown) {
      console.error(err);
      toast.error("Erreur lors de la création du compte");
    }
  };

  const fields = [
    {
      key: "first_name",
      label: "Prénom",
      type: "text",
      icon: <FiUser />,
      placeholder: "Votre prénom",
      autoComplete: "given-name",
    },
    {
      key: "last_name",
      label: "Nom",
      type: "text",
      icon: <FiUser />,
      placeholder: "Votre nom",
      autoComplete: "family-name",
    },
    {
      key: "email",
      label: "Adresse e-mail",
      type: "email",
      icon: <FiMail />,
      placeholder: "votre@email.com",
      autoComplete: "email",
    },
    {
      key: "phone",
      label: "Téléphone (optionnel)",
      type: "tel",
      icon: <FiPhone />,
      placeholder: "+216 XX XXX XXX",
      autoComplete: "tel",
    },
  ];

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center bg-gognet-bg py-8 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="inline-block text-[26px] font-bold">
            smart<span className="text-gognet-orange">shop</span>
          </Link>
          <sub>
            <span className="text-gognet-orange font-black pl-0.5">ML</span>
          </sub>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-card p-6">
          <h1 className="text-[20px] font-bold text-center mb-5">
            Créer un compte
          </h1>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-[14px] text-red-700">
              {typeof error === "object"
                ? Object.entries(error as Record<string, string[]>).map(
                    ([k, v]) => (
                      <p key={k}>
                        <strong className="capitalize">{k}</strong>:{" "}
                        {v.join(", ")}
                      </p>
                    ),
                  )
                : String(error)}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-3">
              {fields.slice(0, 2).map((f) => (
                <div key={f.key}>
                  <label className="block text-[14px] font-semibold mb-1">
                    {f.label}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {f.icon}
                    </span>
                    <input
                      type={f.type}
                      value={(form as Record<string, string>)[f.key]}
                      onChange={set(f.key)}
                      placeholder={f.placeholder}
                      autoComplete={f.autoComplete}
                      required
                      className="input-field pl-9"
                    />
                  </div>
                </div>
              ))}
            </div>
            {fields.slice(2).map((f) => (
              <div key={f.key}>
                <label className="block text-[14px] font-bold mb-1">
                  {f.label}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {f.icon}
                  </span>
                  <input
                    type={f.type}
                    value={(form as Record<string, string>)[f.key]}
                    onChange={set(f.key)}
                    placeholder={f.placeholder}
                    autoComplete={f.autoComplete}
                    required={f.key !== "phone"}
                    className="input-field pl-9"
                  />
                </div>
              </div>
            ))}

            {/* Mot de passe */}
            <div>
              <label className="block text-[14px] font-bold mb-1">
                Mot de passe
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPwd ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  placeholder="Au moins 8 caractères"
                  required
                  minLength={8}
                  className="input-field pl-9 pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPwd ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[14px] font-bold mb-1">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPwd ? "text" : "password"}
                  value={form.password2}
                  onChange={set("password2")}
                  placeholder="Répétez le mot de passe"
                  required
                  className={`input-field pl-9 ${form.password2 && form.password !== form.password2 ? "border-red-400" : ""}`}
                  autoComplete="new-password"
                />
              </div>
              {form.password2 && form.password !== form.password2 && (
                <p className="text-red-500 text-[12px] mt-1">
                  Les mots de passe ne correspondent pas
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                (!!form.password2 && form.password !== form.password2)
              }
              className="btn-secondary w-full py-3 text-[15px] rounded hover:scale-[1.01] active:scale-95 transition-transform disabled:opacity-70"
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? "Création..." : "Créer mon compte"}
            </button>
          </form>
        </div>
        <div className="mt-4 text-center border border-gray-300 rounded-lg py-4 bg-white">
          <p className="text-[13px] text-gray-600">
            Déjà client ?{" "}
            <Link
              to="/login"
              className="text-gognet-blue font-medium hover:underline"
            >
              Se connecter
            </Link>
          </p>
        </div>

        <p className="text-[11px] text-gray-500 mt-4">
          En créant un compte, vous acceptez nos{" "}
          <a href="#" className="text-gognet-blue hover:underline">
            Conditions d'utilisation
          </a>{" "}
          et notre{" "}
          <a href="#" className="text-gognet-blue hover:underline">
            Politique de confidentialité
          </a>
          .
        </p>
      </div>
    </div>
  );
}
