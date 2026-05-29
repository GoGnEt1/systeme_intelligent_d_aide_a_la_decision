import { useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import OtpInput from "../components/ui/OtpInput";
import { useResendTimer } from "../hooks/useResendTimer";
import { useAppDispatch } from "../hooks";
import { verifyResetCode, requestResetCode } from "../store/slices/authSlice";
import toast from "react-hot-toast";

export default function VerifyCodePage() {
  const dispatch = useAppDispatch();
  const location = useLocation();

  const email = location.state?.email;

  const [code, setCode] = useState("");
  // const [resending, setResending] = useState(false);

  const { timeLeft, canResend, reset } = useResendTimer(60);

  const navigate = useNavigate();

  const handleVerify = async () => {
    try {
      await dispatch(verifyResetCode({ email, code })).unwrap();

      toast.success("Code vérifié");

      navigate("/reset-password");
    } catch {
      toast.error("Code incorrect");
    }
  };

  const resend = async () => {
    // setResending(true);
    setCode("");
    try {
      await dispatch(requestResetCode(email)).unwrap();
      toast.success("Code renvoyé");
      reset();
    } catch {
      toast.error("Impossible de renvoyer");
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
            Entrer le code reçu{" "}
          </h1>
          {/* <h1 className="text-xl font-bold mb-4"></h1> */}

          <OtpInput value={code} onChange={setCode} />
          <button
            onClick={handleVerify}
            className="btn-secondary w-full py-3 mt-6 text-[15px] rounded hover:scale-[1.01] active:scale-95 transition-transform disabled:opacity-70"
          >
            Vérifier
          </button>

          <div className="mt-4 text-[13px] text-gray-500">
            {!canResend ? (
              <p>Renvoyer le code dans {timeLeft}s</p>
            ) : (
              <button
                onClick={resend}
                className="text-blue-600 hover:underline"
              >
                Renvoyer le code
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
