import { useState, useEffect, useRef } from "react";
import {
  Link,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../hooks/index";
import {
  loginUser,
  selectIsAuthenticated,
  // selectAuthLoading,
  selectAuthError,
  clearError,
} from "../store/slices/authSlice";
// import toast from "react-hot-toast";
import Alert from "../components/ui/Alert";
import { FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi";

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isAuth = useAppSelector(selectIsAuthenticated);
  const prevIsAuth = useRef(isAuth);
  // const loading = useAppSelector(selectAuthLoading);
  const [loading, setLoading] = useState(false);
  const error = useAppSelector(selectAuthError);
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  // const localItems = useAppSelector((state: RootState) => state.cart.items); // ✅ ici

  // Priorité : state.from (passé par CartDrawer/ProtectedRoute) > ?next= > "/"
  const from =
    (location.state as { from?: string })?.from ||
    searchParams.get("next") ||
    "/";
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isAuth) navigate(from, { replace: true });
    return () => {
      dispatch(clearError());
    };
  }, [isAuth]);

  useEffect(() => {
    const wasAuth = prevIsAuth.current;
    prevIsAuth.current = isAuth;

    // La fusion est gérée par useMergeCartOnLogin dans App/Layout
    // Ne rien faire ici pour éviter le double merge
    if (!isAuth || wasAuth === isAuth) return;
  }, [isAuth, dispatch]);

  const showAlert = (message: string, type: "success" | "error") => {
    setAlert({ message, type });
    setTimeout(() => {
      setAlert(null);
    }, 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!form.email || !form.password) {
      showAlert("Veuillez remplir tous les champs", "error");
      return;
    }
    try {
      await dispatch(loginUser(form)).unwrap();
      showAlert("Connexion réussie !", "success");

      /* if (localItems.length > 0) {
        for (const item of localItems) {
          await dispatch(
            addToCart({
              productId: item.product_id,
              quantity: item.quantity,
            }),
          );
        }
        // dispatch(resetCart()); // vider le panier local après fusion
      } else {
        // Pas d'items locaux → juste recharger le panier serveur
        dispatch(fetchCart());
      }*/

      navigate(from, { replace: true });
      setLoading(false);
    } catch {
      showAlert("Email ou mot de passe incorrect", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center bg-gognet-bg py-8 px-4">
      <div className="w-full max-w-sm">
        {/* Logo min-h-[calc(100vh-120px)]  */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-block text-[26px] font-bold">
            smart<span className="text-gognet-orange">shop</span>
          </Link>
          <sub>
            <span className="text-gognet-orange font-black pl-0.5">ML</span>
          </sub>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-card p-6">
          <h1 className="text-[20px] mb-5 font-bold text-center">Connexion</h1>

          {alert && <Alert message={alert.message} type={alert.type} />}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-[14px] text-red-700">
              {typeof error === "string"
                ? error
                : "Email ou mot de passe incorrect."}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[14px] font-semibold mb-1.5">
                Adresse e-mail
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="votre@email.com"
                  // required
                  className="input-field pl-9"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-[14px] font-semibold mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPwd ? "text" : "password"}
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  // placeholder="••••••••"
                  placeholder="Votre mot de passe"
                  // required
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
            </div>
            <div className="text-right mt-1">
              <Link
                to="/forgot-password"
                className="text-gognet-blue text-[13px] hover:underline"
              >
                Mot de passe oublié ?
              </Link>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-secondary w-full py-3 text-[15px] rounded hover:scale-[1.01] active:scale-95 transition-transform disabled:opacity-70"
            >
              {/* {loading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )} */}
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </div>

        {/* Register link */}
        <div className="mt-4 text-center border border-gray-300 rounded-lg py-4 bg-white">
          <p className="text-[13px] text-gray-600">
            Nouveau client ?{" "}
            <Link
              to="/register"
              className="text-gognet-blue font-medium hover:underline"
            >
              Créer un compte SmartShop
            </Link>
          </p>
        </div>

        <p className="text-[11px] text-gray-500 mt-4">
          En vous connectant, vous acceptez nos{" "}
          <a href="#" className="text-gognet-blue hover:underline">
            Conditions d'utilisation
          </a>
          .
        </p>
      </div>
    </div>
  );
}
