import { useCallback, useRef, useState } from "react";
import type { FlyerKind, FlyerModel, GameVisualMeta, RectLike } from "./types";

export function useFlyers() {
  const [flyers, setFlyers] = useState<FlyerModel[]>([]);
  const resolversRef = useRef(new Map<string, () => void>());

  const addFlyer = useCallback((itemId: string, from: RectLike, to: RectLike, kind: FlyerKind = "move", meta?: GameVisualMeta) => new Promise<void>((resolve) => {
    const id = crypto.randomUUID();
    resolversRef.current.set(id, resolve);
    setFlyers((current) => [...current, { id, itemId, from, to, kind, ...meta }]);
  }), []);

  const completeFlyer = useCallback((id: string) => {
    resolversRef.current.get(id)?.();
    resolversRef.current.delete(id);
    setFlyers((current) => current.filter((flyer) => flyer.id !== id));
  }, []);

  return { flyers, addFlyer, completeFlyer };
}
