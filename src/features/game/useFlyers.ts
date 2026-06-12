import { useCallback, useState } from "react";
import { flyMs, type FlyerKind, type FlyerModel, type RectLike } from "./types";

export function useFlyers() {
  const [flyers, setFlyers] = useState<FlyerModel[]>([]);

  const addFlyer = useCallback((itemId: string, from: RectLike, to: RectLike, kind: FlyerKind = "move") => {
    const id = crypto.randomUUID();
    setFlyers((current) => [...current, { id, itemId, from, to, kind }]);
    window.setTimeout(() => setFlyers((current) => current.filter((flyer) => flyer.id !== id)), flyMs + 80);
  }, []);

  return { flyers, addFlyer };
}
