import { useEffect } from "react";
import { useGameUiStore } from "~/features/game/state/gameUiStore";

export function useSplashDelay(durationMs = 1500) {
  const setSplashReady = useGameUiStore((state) => state.setSplashReady);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSplashReady(true), durationMs);
    return () => window.clearTimeout(timeout);
  }, [durationMs, setSplashReady]);
}
