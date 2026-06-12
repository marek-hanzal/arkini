import { useEffect, useState } from "react";
import type { GameDragData } from "~/play/types";

const defaultMergeHintDelayMs = 2000;

export namespace useDelayedMergeHints {
  export interface Props {
    activeDrag: GameDragData | null;
    delayMs?: number;
  }
}

export function useDelayedMergeHints({
  activeDrag,
  delayMs = defaultMergeHintDelayMs,
}: useDelayedMergeHints.Props) {
  const [visible, setVisible] = useState(false);
  const activeBoardItemId = activeDrag?.source.kind === "board" ? activeDrag.source.boardItemId : null;
  const activeItemId = activeDrag?.source.kind === "board" ? activeDrag.itemId : null;

  useEffect(() => {
    setVisible(false);
    if (!activeBoardItemId || !activeItemId) return;

    const timeout = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timeout);
  }, [activeBoardItemId, activeItemId, delayMs]);

  return visible;
}
