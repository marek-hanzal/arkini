import { useState } from "react";
import { flyMs, type FlyerModel, type RectLike } from "./types";

export function useFlyers() {
  const [flyers, setFlyers] = useState<FlyerModel[]>([]);

  function addFlyer(itemId: string, from: RectLike, to: RectLike) {
    const id = crypto.randomUUID();
    setFlyers((current) => [...current, { id, itemId, from, to }]);
    window.setTimeout(() => setFlyers((current) => current.filter((flyer) => flyer.id !== id)), flyMs + 80);
  }

  return { flyers, addFlyer };
}
