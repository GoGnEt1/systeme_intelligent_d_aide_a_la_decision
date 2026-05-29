import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { requestResetCode } from "../store/slices/authSlice";
import toast from "react-hot-toast";
import { useAppDispatch } from "../hooks";
import { FiMail } from "react-icons/fi";

export default function ForgotPasswordPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    if (!email) {
      toast.error("Veuillez renseigner un email");
      return;
    }

    try {
      const res = await dispatch(requestResetCode(email)).unwrap();

      toast.success(res.message);

      navigate("/verify-code", {
        state: { email },
      });
      localStorage.setItem("email", email);
    } catch (err: any) {
      toast.error(err?.error || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center bg-gognet-bg py-8 px-4">
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
            Mot de passe oublié
          </h1>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[14px] font-semibold mb-2">
                Adresse e-mail
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-9"
                  autoComplete="email"
                  placeholder="votre@email.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-secondary w-full py-3 text-[15px] rounded hover:scale-[1.01] active:scale-95 transition-transform disabled:opacity-70"
            >
              {loading ? "Envoi..." : "Envoyer le code"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
