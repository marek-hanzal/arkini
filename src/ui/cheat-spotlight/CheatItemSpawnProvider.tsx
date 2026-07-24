import { type PropsWithChildren, useMemo } from "react";

import { useSpawnCheatItemMutation } from "~/bridge/cheat/useSpawnCheatItemMutation";
import type { Game } from "~/bridge/game/Game";
import { useExclusiveAction } from "~/ui/action/useExclusiveAction";
import {
	CheatItemSpawnContext,
	type CheatItemSpawnControl,
} from "~/ui/cheat-spotlight/CheatItemSpawnContext";

/** Keeps one Cheat spawn observer and synchronous admission owner alive across Game child routes. */
export const CheatItemSpawnProvider = ({
	children,
	game,
}: PropsWithChildren<{
	readonly game: Game;
}>) => {
	const spawn = useSpawnCheatItemMutation(game);
	const action = useExclusiveAction<"spawn">();
	const pending = action.active !== null || spawn.isPending;
	const control = useMemo<CheatItemSpawnControl>(
		() => ({
			error: spawn.error,
			isError: spawn.isError,
			isSuccess: spawn.isSuccess,
			pending,
			request: (itemId) => {
				if (spawn.isPending || !action.claim("spawn")) return false;
				spawn.mutate(itemId, {
					onSettled: () => action.release("spawn"),
				});
				return true;
			},
			reset: () => {
				if (action.getSnapshot() === null && !spawn.isPending) spawn.reset();
			},
		}),
		[
			action,
			pending,
			spawn,
		],
	);

	return (
		<CheatItemSpawnContext.Provider value={control}>{children}</CheatItemSpawnContext.Provider>
	);
};
