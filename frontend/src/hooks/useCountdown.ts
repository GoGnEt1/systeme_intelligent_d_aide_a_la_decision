import { useEffect, useState } from "react";

export function useCountdown(expireAt: number) {
  const [timeLeft, setTimeLeft] = useState(expireAt - Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(expireAt - Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [expireAt]);

  const minutes = Math.max(0, Math.floor(timeLeft / 60000));
  const seconds = Math.max(0, Math.floor((timeLeft % 60000) / 1000));

  return { minutes, seconds, expired: timeLeft <= 0 };
}
