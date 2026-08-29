import { useCallback } from "react";

import type { PlayableGame } from "~/renderer/game/PlayableGame";
import { useRuntimeSelector } from "~/ui/game/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** Subscribes to the persisted cheat state of one exact route-scoped Game. */
export const useGameCheats = (game: PlayableGame) => {
	const selector = useCallback((runtime: RuntimeSchema.Type) => runtime.cheats, []);
	return useRuntimeSelector(game, selector);
};
