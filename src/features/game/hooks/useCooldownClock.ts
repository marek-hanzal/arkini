import { useEffect } from "react";
import { useGameUiStore } from "~/features/game/state/gameUiStore";

export function useCooldownClock(intervalMs = 150) {
  const activeDrag = useGameUiStore((state) => state.activeDrag);
  const setNowMs = useGameUiStore((state) => state.setNowMs);

  useEffect(() => {
    if (activeDrag) return;

    const interval = window.setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => window.clearInterval(interval);
  }, [activeDrag, intervalMs, setNowMs]);
}
