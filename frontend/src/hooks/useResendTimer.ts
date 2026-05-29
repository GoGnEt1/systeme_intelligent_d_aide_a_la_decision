import { useEffect, useState } from "react";

export function useResendTimer(delay = 60) {
  const [timeLeft, setTimeLeft] = useState(delay);

  useEffect(() => {
    if (timeLeft === 0) return;

    const timer = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  return {
    timeLeft,
    canResend: timeLeft === 0,
    reset: () => setTimeLeft(delay),
  };
}
