import { useCallback, useState } from "react";
import { flyHoldMs, flyMs, type FlyerKind, type FlyerModel, type GameVisualMeta, type RectLike } from "./types";

export function useFlyers() {
  const [flyers, setFlyers] = useState<FlyerModel[]>([]);

  const addFlyer = useCallback((itemId: string, from: RectLike, to: RectLike, kind: FlyerKind = "move", meta?: GameVisualMeta) => {
    const id = crypto.randomUUID();
    setFlyers((current) => [...current, { id, itemId, from, to, kind, ...meta }]);
    window.setTimeout(() => setFlyers((current) => current.filter((flyer) => flyer.id !== id)), flyMs + flyHoldMs);
  }, []);

  return { flyers, addFlyer };
}
