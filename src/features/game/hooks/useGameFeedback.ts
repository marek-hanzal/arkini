import { useCallback } from "react";
import { toast } from "sonner";
import type { GameView } from "~/domains/database";
import { boardPulseMs, mergePulseMs } from "~/features/game/components/constants";
import { boardCellKey } from "~/features/game/components/helpers/boardCellId";
import type { DragData } from "~/features/game/components/types";
import { useGameUiStore } from "~/features/game/state/gameUiStore";

export function useGameFeedback() {
  const setInvalidTargetId = useGameUiStore((state) => state.setInvalidTargetId);
  const setInventoryPulseSlot = useGameUiStore((state) => state.setInventoryPulseSlot);
  const setBoardPulseCell = useGameUiStore((state) => state.setBoardPulseCell);
  const setMergePulseBoardItemId = useGameUiStore((state) => state.setMergePulseBoardItemId);

  const markInvalid = useCallback((targetId?: string) => {
    if (!targetId) return;
    setInvalidTargetId(targetId);
    window.setTimeout(() => setInvalidTargetId(null), 650);
  }, [setInvalidTargetId]);

  const pulseInventory = useCallback((slotIndex: number | null | undefined) => {
    if (slotIndex === null || slotIndex === undefined) return;
    setInventoryPulseSlot(slotIndex);
    window.setTimeout(() => setInventoryPulseSlot(null), 700);
  }, [setInventoryPulseSlot]);

  const pulseBoard = useCallback((cellKey: string | null | undefined) => {
    if (!cellKey) return;
    setBoardPulseCell(cellKey);
    window.setTimeout(() => setBoardPulseCell(null), boardPulseMs);
  }, [setBoardPulseCell]);

  const pulseMerge = useCallback((boardItemId: string) => {
    setMergePulseBoardItemId(boardItemId);
    window.setTimeout(() => setMergePulseBoardItemId(null), mergePulseMs);
  }, [setMergePulseBoardItemId]);

  const showActionError = useCallback((error: unknown, invalidId?: string) => {
    markInvalid(invalidId);
    if (invalidId) return;
    toast.error(error instanceof Error ? error.message : "Action failed.");
  }, [markInvalid]);

  const pulseDragOrigin = useCallback((game: GameView | null | undefined, source: DragData) => {
    if (!game) return;

    if (source.type === "inventory") {
      pulseInventory(source.slotIndex);
      return;
    }

    const boardItem = game.boardItemsById[source.boardItemId];
    if (!boardItem) return;
    pulseBoard(boardCellKey(boardItem.x, boardItem.y));
  }, [pulseBoard, pulseInventory]);

  return { markInvalid, pulseInventory, pulseBoard, pulseMerge, pulseDragOrigin, showActionError };
}
