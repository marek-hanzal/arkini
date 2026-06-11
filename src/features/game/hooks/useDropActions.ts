import { useCallback } from "react";
import type { GameView } from "~/domains/database";
import { invalidDropReturnMs } from "~/features/game/components/constants";
import type { DragData } from "~/features/game/components/types";
import { useGameUiStore } from "~/features/game/state/gameUiStore";
import { useGameFeedback } from "./useGameFeedback";

export function useDropActions(game: GameView | null | undefined) {
  const { markInvalid, pulseDragOrigin, showActionError } = useGameFeedback();
  const setSelection = useGameUiStore((state) => state.setSelection);
  const setActiveDrag = useGameUiStore((state) => state.setActiveDrag);
  const setCommittedDrag = useGameUiStore((state) => state.setCommittedDrag);
  const setReturningDrag = useGameUiStore((state) => state.setReturningDrag);

  const commit = useCallback(
    async (action: () => Promise<unknown>, source: DragData, invalidId?: string, onSuccess?: () => void) => {
      setCommittedDrag(source);
      setReturningDrag(null);
      setActiveDrag(null);

      try {
        await action();
        onSuccess?.();
        setSelection(null);
      } catch (error) {
        setCommittedDrag(null);
        showActionError(error, invalidId);
        return;
      }

      setCommittedDrag(null);
    },
    [setActiveDrag, setCommittedDrag, setReturningDrag, setSelection, showActionError],
  );

  const reject = useCallback(
    (source: DragData, invalidId?: string) => {
      setReturningDrag(source);
      setActiveDrag(null);
      markInvalid(invalidId);
      window.setTimeout(() => {
        setReturningDrag(null);
        pulseDragOrigin(game, source);
      }, invalidDropReturnMs + 120);
    },
    [game, markInvalid, pulseDragOrigin, setActiveDrag, setReturningDrag],
  );

  return { commit, reject };
}
