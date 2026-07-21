import { useCallback, useSyncExternalStore } from "react";

import type { Game } from "~/bridge/game/Game";

/** Subscribes to the persisted cheat state of one exact route-scoped Game. */
export const useGameCheats = (game: Game) => {
	const subscribe = useCallback(
		(listener: () => void) => game.subscribe(listener),
		[
			game,
		],
	);
	const read = useCallback(
		() => game.getSnapshot().cheats,
		[
			game,
		],
	);
	return useSyncExternalStore(subscribe, read, read);
};
