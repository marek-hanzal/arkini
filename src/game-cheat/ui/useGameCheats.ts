import { useCallback } from "react";

import type { PlayableGame } from "~/playable-game/type/PlayableGame";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** Subscribes to the persisted cheat state of one exact route-scoped Game. */
export const useGameCheats = (game: PlayableGame) => {
	const selectorFn = useCallback((runtime: RuntimeSchema.Type) => runtime.cheats, []);
	return useRuntimeSelector(game, selectorFn);
};
