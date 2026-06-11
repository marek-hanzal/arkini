import { useGameAction } from "~/hooks/useGameView";

export function useGameMutations() {
  return {
    placeInventory: useGameAction((db, input: { slotIndex: number; x: number; y: number }) =>
      db.placeInventoryItem(input.slotIndex, input.x, input.y),
    ),
    moveBoard: useGameAction((db, input: { boardItemId: string; x: number; y: number }) =>
      db.moveBoardItem(input.boardItemId, input.x, input.y),
    ),
    stashBoard: useGameAction((db, input: { boardItemId: string; slotIndex?: number }) =>
      db.stashBoardItem(input.boardItemId, input.slotIndex),
    ),
    mergeBoard: useGameAction((db, input: { sourceBoardItemId: string; targetBoardItemId: string }) =>
      db.mergeBoardItems(input.sourceBoardItemId, input.targetBoardItemId),
    ),
    swapInventory: useGameAction((db, input: { sourceSlotIndex: number; targetSlotIndex: number }) =>
      db.swapInventorySlots(input.sourceSlotIndex, input.targetSlotIndex),
    ),
    produce: useGameAction(
      (db, input: { boardItemId: string }) => db.produceBoardItem(input.boardItemId),
      { invalidateOnSuccess: false },
    ),
    build: useGameAction((db, input: { recipeId: string; x: number; y: number }) =>
      db.buildRecipe(input.recipeId, input.x, input.y),
    ),
  };
}

export type GameMutations = ReturnType<typeof useGameMutations>;
