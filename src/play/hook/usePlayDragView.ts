import { useMemo } from "react";
import type { GameDragView } from "~/play/logic/playTypes";
import { usePlayBoard } from "./usePlayBoard";
import { usePlayInventory } from "./usePlayInventory";

export function usePlayDragView(): GameDragView | null {
  const board = usePlayBoard().data;
  const inventory = usePlayInventory().data;

  return useMemo(() => {
    if (!board || !inventory) return null;
    return {
      boardItemsById: board.byId,
      inventoryBySlotIndex: inventory.bySlotIndex,
    };
  }, [board, inventory]);
}
