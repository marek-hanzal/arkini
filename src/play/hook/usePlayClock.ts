import { useEffect, useState } from "react";

export function usePlayClock(tickMs = 250) {
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), tickMs);
    return () => window.clearInterval(interval);
  }, [tickMs]);

  return nowMs;
}
