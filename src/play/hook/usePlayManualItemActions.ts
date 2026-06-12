import { useCallback } from "react";
import { boardColumns, boardRows, boardSourceId, type BoardCell } from "~/board/boardIdentity";
import { cellKey } from "~/board/util/cell";
import { inventorySourceId } from "~/inventory/inventoryIdentity";
import { inventorySinkRect } from "~/inventory/util/inventory";
import type { GameDragFeedback } from "~/play/hook/usePlayDraggableControl";
import { usePlayAction, usePlayView } from "~/play/hook/usePlayView";
import type { BoardViewItem, GameView, InventorySlot } from "~/play/logic/playTypes";
import type { FlyerKind, GameVisualMeta, RectLike } from "~/play/types";
import { playBottomNavPulse } from "~/play/util/animation";
import { queryElement } from "~/shared/util/queryElement";
import { queryRect } from "~/shared/util/queryRect";

export namespace usePlayManualItemActions {
  export interface Props {
    addFlyer(itemId: string, from: RectLike, to: RectLike, kind?: FlyerKind, meta?: GameVisualMeta): Promise<void>;
    feedback: GameDragFeedback;
    schedule(label: string, operation: () => Promise<void>): Promise<void>;
    hideSources(ids: readonly string[]): void;
    clearHiddenSources(): void;
  }
}

export function usePlayManualItemActions({
  addFlyer,
  feedback,
  schedule,
  hideSources,
  clearHiddenSources,
}: usePlayManualItemActions.Props) {
  const game = usePlayView().data;
  const placeInventory = usePlayAction((db, input: { slotIndex: number; x: number; y: number }) => db.placeInventoryItem(input.slotIndex, input.x, input.y));
  const stashBoard = usePlayAction((db, input: { boardItemId: string; slotIndex?: number }) => db.stashBoardItem(input.boardItemId, input.slotIndex));

  const stashBoardWithFly = useCallback(async (boardItem: BoardViewItem) => {
    await schedule("stash board item", async () => {
      const sourceId = boardSourceId(boardItem.id);
      const from = queryRect(`[data-board-item-id="${boardItem.id}"]`)
        ?? queryRect(`[data-board-cell="${boardItem.x}:${boardItem.y}"]`);

      try {
        await stashBoard.mutateAsync({ boardItemId: boardItem.id });

        if (from) {
          hideSources([sourceId]);
          await addFlyer(boardItem.itemId, from, inventorySinkRect(from, queryRect('[data-bottom-nav-sheet="inventory"]')), "stash");
        }

        pulseBottomNav("inventory");
      } catch (error) {
        feedback.flashBoardCell(cellKey(boardItem.x, boardItem.y), "error");
        feedback.showError(error);
      } finally {
        clearHiddenSources();
      }
    });
  }, [addFlyer, clearHiddenSources, feedback, hideSources, schedule, stashBoard]);

  const placeInventoryOnBoardWithFly = useCallback(async (slot: InventorySlot) => {
    await schedule("place inventory item", async () => {
      const stack = slot.stack;
      const target = game ? findFirstEmptyBoardCell(game) : null;

      if (!stack || !target) {
        feedback.flashInventorySlot(slot.slotIndex, "error");
        return;
      }

      const sourceId = inventorySourceId(slot.slotIndex);
      const from = queryRect(`[data-inventory-slot="${slot.slotIndex}"]`);
      const to = queryRect(`[data-board-cell="${target.x}:${target.y}"]`);

      try {
        await placeInventory.mutateAsync({ slotIndex: slot.slotIndex, x: target.x, y: target.y });

        if (from && to && stack.quantity <= 1) hideSources([sourceId]);
        if (from && to) await addFlyer(stack.itemId, from, to, "place", { quantity: stack.quantity });
      } catch (error) {
        feedback.flashInventorySlot(slot.slotIndex, "error");
        feedback.showError(error);
      } finally {
        clearHiddenSources();
      }
    });
  }, [addFlyer, clearHiddenSources, feedback, game, hideSources, placeInventory, schedule]);

  return { stashBoardWithFly, placeInventoryOnBoardWithFly };
}

function pulseBottomNav(sheet: "inventory") {
  const element = queryElement(`[data-bottom-nav-sheet="${sheet}"]`);
  if (element) playBottomNavPulse(element);
}

function findFirstEmptyBoardCell(game: GameView): BoardCell | null {
  for (let y = 0; y < boardRows; y++) {
    for (let x = 0; x < boardColumns; x++) {
      if (!game.boardItemByCellKey[cellKey(x, y)]) return { x, y };
    }
  }

  return null;
}
