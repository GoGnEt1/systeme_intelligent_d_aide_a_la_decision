import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../hooks/index";
import {
  resetPassword,
  loginUser,
  selectIsAuthenticated,
  clearError,
} from "../store/slices/authSlice";
import toast from "react-hot-toast";
import { FiLock, FiEye, FiEyeOff } from "react-icons/fi";

export default function ResetPasswordPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuth = useAppSelector(selectIsAuthenticated);

  const email = localStorage.getItem("email") || "";
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const from = (location.state as { from?: string })?.from || "/";

  useEffect(() => {
    if (isAuth) navigate(from, { replace: true });
    return () => {
      dispatch(clearError());
    };
  }, [isAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirm) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    if (password !== confirm) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    try {
      await dispatch(
        resetPassword({
          email,
          new_password: password,
          confirm_password: confirm,
        }),
      ).unwrap();

      await dispatch(loginUser({ email, password })).unwrap();
      toast.success("Mot de passe modifié");
      localStorage.removeItem("email");
    } catch (err: any) {
      toast.error(err?.error || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className=" flex items-center justify-center bg-gognet-bg py-8 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="inline-block text-[26px] font-bold">
            smart<span className="text-gognet-orange">shop</span>
          </Link>
          <sub>
            <span className="text-gognet-orange font-black pl-0.5">ML</span>
          </sub>
        </div>
        <div className="w-full max-w-md bg-white shadow-card rounded-lg p-6">
          <h1 className="text-[20px] font-bold text-center mb-6">
            Réinitialiser le mot de passe
          </h1>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPwd ? "text" : "password"}
                placeholder="Nouveau mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pl-9 pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPwd ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>

            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPwd ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Répétez le mot de passe"
                required
                className={`input-field pl-9 ${confirm && password !== confirm ? "border-red-400" : ""}`}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-secondary w-full py-3 text-[15px] rounded hover:scale-[1.01] active:scale-95 transition-transform disabled:opacity-70"
            >
              {loading ? "Réinitialisation..." : "Réinitialiser"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
