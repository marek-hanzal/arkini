import { useAtom } from "@effect/atom-react";
import type { Effect } from "effect";
import { useCallback, useMemo } from "react";

import type { PlayableGame } from "~/playable-game/type/PlayableGame";
import { useGameCheats } from "~/game-cheat/ui/useGameCheats";
import { updateGameCheatsAtom } from "~/game-cheat/atom/updateGameCheatsAtom";

export namespace useCheatsModel {
	export interface Model {
		readonly blocked: boolean;
		readonly enabled: boolean;
		readonly instantGameplay: boolean;
		readonly status: updateGameCheatsAtom.State;
		readonly requestExitFn: (runFx: Effect.Effect<void, unknown, never>) => void;
		readonly setEnabledFn: (enabled: boolean) => void;
		readonly setInstantGameplayFn: (enabled: boolean) => void;
	}
}

/** Owns the one exact-Game Cheat command state shared by navigation and presentation. */
export const useCheatsModel = (game: PlayableGame): useCheatsModel.Model => {
	const cheats = useGameCheats(game);
	const commandAtom = updateGameCheatsAtom(game);
	const [commandState, runCommandFn] = useAtom(commandAtom);
	const requestExitFn = useCallback(
		(runFx: Effect.Effect<void, unknown, never>) => {
			runCommandFn({
				action: "exit",
				runFx,
			});
		},
		[
			runCommandFn,
		],
	);
	const setEnabledFn = useCallback(
		(enabled: boolean) => {
			runCommandFn({
				action: "cheat-mode",
				enabled,
			});
		},
		[
			runCommandFn,
		],
	);
	const setInstantGameplayFn = useCallback(
		(enabled: boolean) => {
			runCommandFn({
				action: "instant-gameplay",
				enabled,
			});
		},
		[
			runCommandFn,
		],
	);
	return useMemo(
		() => ({
			blocked: commandState.kind === "pending",
			enabled: cheats.enabled,
			instantGameplay: cheats.instantGameplay,
			status: commandState,
			requestExitFn,
			setEnabledFn,
			setInstantGameplayFn,
		}),
		[
			cheats.enabled,
			cheats.instantGameplay,
			commandState,
			requestExitFn,
			setEnabledFn,
			setInstantGameplayFn,
		],
	);
};
