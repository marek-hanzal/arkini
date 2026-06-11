import type { GameMutations } from "./useGameMutations";
import { useGameUiStore } from "~/features/game/state/gameUiStore";

export function usePendingGameActions(mutations: GameMutations) {
  const flyout = useGameUiStore((state) => state.flyout);
  const hiddenBoardItemIds = useGameUiStore((state) => state.hiddenBoardItemIds);
  const returningDrag = useGameUiStore((state) => state.returningDrag);

  return (
    mutations.placeInventory.isPending ||
    mutations.moveBoard.isPending ||
    mutations.stashBoard.isPending ||
    mutations.mergeBoard.isPending ||
    mutations.swapInventory.isPending ||
    mutations.produce.isPending ||
    mutations.build.isPending ||
    flyout !== null ||
    hiddenBoardItemIds.size > 0 ||
    returningDrag !== null
  );
}
