import { useCallback } from "react";
import { cellKey } from "~/board/util/cell";
import { inventorySinkRect } from "~/inventory/util/inventory";
import type { BoardViewItem, ProducerDropResult } from "~/play/server/playTypes";
import { usePlayAction, usePlayDataInvalidation } from "~/play/hook/usePlayView";
import type { GameDragFeedback } from "~/play/hook/usePlayDraggableControl";
import type { ActiveSheet } from "~/play/ui/BottomNavigation";
import type { FlyerKind, GameVisualMeta, RectLike } from "~/play/types";
import { cssEscape, queryRect } from "~/shared/util/dom";

export function usePlayProducerActions({
  activeSheet,
  addFlyer,
  feedback,
  schedule,
}: Readonly<{
  activeSheet: ActiveSheet;
  addFlyer(itemId: string, from: RectLike, to: RectLike, kind?: FlyerKind, meta?: GameVisualMeta): Promise<void>;
  feedback: GameDragFeedback;
  schedule(label: string, operation: () => Promise<void>): Promise<void>;
}>) {
  const invalidatePlayData = usePlayDataInvalidation();
  const produce = usePlayAction(
    (db, input: { boardItemId: string; activation?: "single" | "exhaust" }) =>
      db.produceBoardItem(input.boardItemId, input.activation),
    { invalidateOnSuccess: false },
  );

  const animateProducerDrops = useCallback(async (results: ProducerDropResult[], stepDelayMs = 0) => {
    const animations: Promise<void>[] = [];

    for (const result of results) {
      const sourceRect = queryRect(`[data-board-item-id="${cssEscape(result.producerBoardItemId)}"]`);
      if (!sourceRect) continue;
      const from = sourceRect;

      for (const placement of result.placements) {
        const targetRect = placement.kind === "board"
          ? queryRect(`[data-board-cell="${placement.x}:${placement.y}"]`)
          : activeSheet === "inventory" ? queryRect(`[data-inventory-slot="${placement.slotIndex}"]`) : null;

        if (placement.kind === "board") {
          if (!targetRect) continue;
          animations.push(addFlyer(placement.itemId, from, targetRect));
        } else {
          animations.push(addFlyer(placement.itemId, from, targetRect ?? inventorySinkRect(from)));
        }

        if (stepDelayMs > 0) await new Promise((resolve) => window.setTimeout(resolve, stepDelayMs));
      }
    }

    await Promise.all(animations);
  }, [activeSheet, addFlyer]);

  return useCallback(async (boardItem: BoardViewItem, activation: "single" | "exhaust" = "single") => {
    await schedule(`producer ${activation}`, async () => {
      try {
        const result = await produce.mutateAsync({ boardItemId: boardItem.id, activation });
        await animateProducerDrops([result], activation === "exhaust" ? 130 : 0);
        await invalidatePlayData();
      } catch (error) {
        feedback.flashBoardCell(cellKey(boardItem.x, boardItem.y), "error");
        feedback.showError(error);
      }
    });
  }, [animateProducerDrops, feedback, invalidatePlayData, produce, schedule]);
}
