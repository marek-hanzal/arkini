import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

import { getCachedGameEngineResource } from "~/bridge/game/getCachedGameEngineResource";

const subscribeToNothing = () => () => undefined;
const readNothing = () => null;

/** Reads persisted cheat state from the currently cached Game without creating one. */
export const useActiveGameCheats = () => {
	const queryClient = useQueryClient();
	const resource = getCachedGameEngineResource(queryClient);
	resource?.assertUsable();
	const game = resource?.game ?? null;
	const subscribe = useCallback(
		(listener: () => void) => game?.subscribe(listener) ?? subscribeToNothing(),
		[
			game,
		],
	);
	const read = useCallback(
		() => game?.getSnapshot().cheats ?? readNothing(),
		[
			game,
		],
	);
	const cheats = useSyncExternalStore(subscribe, read, read);
	return {
		cheats,
		game,
	};
};
