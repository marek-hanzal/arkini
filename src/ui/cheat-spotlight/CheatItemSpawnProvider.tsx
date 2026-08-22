import { useAtom } from "@effect/atom-react";
import { type PropsWithChildren, useMemo } from "react";

import type { PlayableGame } from "~/bridge/game/PlayableGame";
import { CheatItemSpawnCommandAtom } from "~/ui/cheat-spotlight/CheatItemSpawnCommandAtom";
import {
	CheatItemSpawnContext,
	type CheatItemSpawnControl,
} from "~/ui/cheat-spotlight/CheatItemSpawnContext";

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

	const control = useMemo<CheatItemSpawnControl>(
		() => ({
			pending,
			request: (itemId) => {
				runCommand({
					kind: "spawn",
					itemId,
				});
			},
			reset: () => {
				runCommand({
					kind: "reset",
				});
			},
			state,
		}),
		[
			pending,
			runCommand,
			state,
		],
	);

	return (
		<CheatItemSpawnContext.Provider value={control}>{children}</CheatItemSpawnContext.Provider>
	);
};
