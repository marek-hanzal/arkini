import { useGameAction } from "~/hooks/useGameView";

export function useGameMutations() {
  return {
    placeInventory: useGameAction((db, input: useGameMutations.PlaceInventory) =>
      db.placeInventoryItem(input.slotIndex, input.x, input.y),
    ),
    moveBoard: useGameAction((db, input: useGameMutations.MoveBoard) =>
      db.moveBoardItem(input.boardItemId, input.x, input.y),
    ),
    stashBoard: useGameAction((db, input: useGameMutations.StashBoard) =>
      db.stashBoardItem(input.boardItemId, input.slotIndex),
    ),
    mergeBoard: useGameAction((db, input: useGameMutations.MergeBoard) =>
      db.mergeBoardItems(input.sourceBoardItemId, input.targetBoardItemId),
    ),
    swapInventory: useGameAction((db, input: useGameMutations.SwapInventory) =>
      db.swapInventorySlots(input.sourceSlotIndex, input.targetSlotIndex),
    ),
    produce: useGameAction((db, input: useGameMutations.Produce) => db.produceBoardItem(input.boardItemId), {
      invalidateOnSuccess: false,
    }),
    build: useGameAction((db, input: useGameMutations.Build) => db.buildRecipe(input.recipeId, input.x, input.y)),
  };
}

export namespace useGameMutations {
  export interface PlaceInventory {
    slotIndex: number;
    x: number;
    y: number;
  }

  export interface MoveBoard {
    boardItemId: string;
    x: number;
    y: number;
  }

  export interface StashBoard {
    boardItemId: string;
    slotIndex?: number;
  }

  export interface MergeBoard {
    sourceBoardItemId: string;
    targetBoardItemId: string;
  }

  export interface SwapInventory {
    sourceSlotIndex: number;
    targetSlotIndex: number;
  }

  export interface Produce {
    boardItemId: string;
  }

  export interface Build {
    recipeId: string;
    x: number;
    y: number;
  }

  export type Result = ReturnType<typeof useGameMutations>;
}

export type GameMutations = useGameMutations.Result;
