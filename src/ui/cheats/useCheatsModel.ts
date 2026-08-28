import { useAtom } from "@effect/atom-react";
import type { Effect } from "effect";
import { useCallback, useMemo } from "react";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { useGameCheats } from "~/bridge/cheat/useGameCheats";
import { updateGameCheatsAtom } from "~/ui/cheats/updateGameCheatsAtom";

export namespace useCheatsModel {
	export interface Model {
		readonly blocked: boolean;
		readonly enabled: boolean;
		readonly instantGameplay: boolean;
		readonly status: updateGameCheatsAtom.State;
		readonly requestExit: (runFx: Effect.Effect<void, unknown>) => void;
		readonly setEnabled: (enabled: boolean) => void;
		readonly setInstantGameplay: (enabled: boolean) => void;
	}
}

/** Owns the one exact-Game Cheat command state shared by navigation and presentation. */
export const useCheatsModel = (game: GameEngine): useCheatsModel.Model => {
	const cheats = useGameCheats(game);
	const commandAtom = updateGameCheatsAtom(game);
	const [commandState, runCommand] = useAtom(commandAtom);
	const requestExit = useCallback(
		(runFx: Effect.Effect<void, unknown>) => {
			runCommand({
				action: "exit",
				runFx,
			});
		},
		[
			runCommand,
		],
	);
	const setEnabled = useCallback(
		(enabled: boolean) => {
			runCommand({
				action: "cheat-mode",
				enabled,
			});
		},
		[
			runCommand,
		],
	);
	const setInstantGameplay = useCallback(
		(enabled: boolean) => {
			runCommand({
				action: "instant-gameplay",
				enabled,
			});
		},
		[
			runCommand,
		],
	);
	return useMemo(
		() => ({
			blocked: commandState.kind === "pending",
			enabled: cheats.enabled,
			instantGameplay: cheats.instantGameplay,
			status: commandState,
			requestExit,
			setEnabled,
			setInstantGameplay,
		}),
		[
			cheats.enabled,
			cheats.instantGameplay,
			commandState,
			requestExit,
			setEnabled,
			setInstantGameplay,
		],
	);
};
