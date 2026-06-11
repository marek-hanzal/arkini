import type { GameView } from "~/domains/database";
import { useDragHandlers } from "./useDragHandlers";
import { useFlyoutActions } from "./useFlyoutActions";
import { useGameMutations } from "./useGameMutations";
import { usePendingGameActions } from "./usePendingGameActions";

export function useGameInteractions(game: GameView | null | undefined) {
  const mutations = useGameMutations();
  const pending = usePendingGameActions(mutations);
  const drag = useDragHandlers(game, mutations);
  const actions = useFlyoutActions(game, mutations);

  return { pending, ...drag, ...actions };
}
