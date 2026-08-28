import { useCallback } from "react";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Subscribes to the persisted cheat state of one exact route-scoped Game. */
export const useGameCheats = (game: GameEngine) => {
	const selector = useCallback((runtime: RuntimeSchema.Type) => runtime.cheats, []);
	return useRuntimeSelector(game, selector);
};
