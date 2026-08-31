import { useAtom } from "@effect/atom-react";
import { type PropsWithChildren, useCallback, useMemo } from "react";

import type { PlayableGame } from "~/playable-game/type/PlayableGame";
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
	const [state, runCommandFn] = useAtom(commandAtom);
	const pending = state.kind === "pending";
	const requestFn = useCallback(
		(itemId: string) => {
			runCommandFn({
				kind: "spawn",
				itemId,
			});
		},
		[
			runCommandFn,
		],
	);
	const resetFn = useCallback(() => {
		runCommandFn({
			kind: "reset",
		});
	}, [
		runCommandFn,
	]);

	const control = useMemo<CheatItemSpawnControl>(
		() => ({
			pending,
			requestFn,
			resetFn,
			state,
		}),
		[
			pending,
			requestFn,
			resetFn,
			state,
		],
	);

	return (
		<CheatItemSpawnContext.Provider value={control}>{children}</CheatItemSpawnContext.Provider>
	);
};
