import { useAtom } from "@effect/atom-react";
import { type PropsWithChildren, useCallback, useMemo } from "react";

import type { PlayableGame } from "~/renderer/game/PlayableGame";
import { CheatItemSpawnCommandAtom } from "~/game-cheat/atom/CheatItemSpawnCommandAtom";
import {
	CheatItemSpawnContext,
	type CheatItemSpawnControl,
} from "~/game-cheat/context/CheatItemSpawnContext";

/** Keeps one Cheat spawn observer and synchronous admission owner alive across Game child routes. */
export const CheatItemSpawnProvider = ({
	children,
	game,
}: PropsWithChildren<{
	readonly game: PlayableGame;
}>) => {
	const commandAtom = CheatItemSpawnCommandAtom(game);
	const [state, runCommand] = useAtom(commandAtom);
	const pending = state.kind === "pending";
	const request = useCallback(
		(itemId: string) => {
			runCommand({
				kind: "spawn",
				itemId,
			});
		},
		[
			runCommand,
		],
	);
	const reset = useCallback(() => {
		runCommand({
			kind: "reset",
		});
	}, [
		runCommand,
	]);

	const control = useMemo<CheatItemSpawnControl>(
		() => ({
			pending,
			request,
			reset,
			state,
		}),
		[
			pending,
			request,
			reset,
			state,
		],
	);

	return (
		<CheatItemSpawnContext.Provider value={control}>{children}</CheatItemSpawnContext.Provider>
	);
};
