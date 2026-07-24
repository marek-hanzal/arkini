import { useAtom } from "@effect/atom-react";
import type { Effect } from "effect";
import { match } from "ts-pattern";

import type { Game } from "~/bridge/game/Game";
import { useGameCheats } from "~/bridge/cheat/useGameCheats";
import { updateGameCheatsAtom } from "~/ui/cheats/updateGameCheatsAtom";

export namespace useCheatsModel {
	export type Status =
		| {
				readonly kind: "idle";
		  }
		| {
				readonly kind: "pending";
				readonly label: "Cheat mode" | "Instant gameplay";
		  }
		| {
				readonly kind: "error";
				readonly error: unknown;
				readonly label: "Cheat mode" | "Instant gameplay";
		  }
		| {
				readonly kind: "success";
				readonly label: "Cheat mode" | "Instant gameplay";
		  }
		| {
				readonly kind: "navigation-error";
				readonly error: unknown;
		  };

	export interface Model {
		readonly blocked: boolean;
		readonly enabled: boolean;
		readonly instantGameplay: boolean;
		readonly status: Status;
		readonly requestExit: (runFx: Effect.Effect<void, unknown>) => void;
		readonly setEnabled: (enabled: boolean) => void;
		readonly setInstantGameplay: (enabled: boolean) => void;
	}
}

/** Owns the one exact-Game Cheat command state shared by navigation and presentation. */
export const useCheatsModel = (game: Game): useCheatsModel.Model => {
	const cheats = useGameCheats(game);
	const commandAtom = updateGameCheatsAtom(game);
	const [commandState, runCommand] = useAtom(commandAtom);
	const status = match(commandState)
		.with(
			{
				kind: "idle",
			},
			(): useCheatsModel.Status => ({
				kind: "idle",
			}),
		)
		.with(
			{
				kind: "pending",
				action: "exit",
			},
			(): useCheatsModel.Status => ({
				kind: "idle",
			}),
		)
		.with(
			{
				kind: "pending",
			},
			({ action }): useCheatsModel.Status => ({
				kind: "pending",
				label: action === "instant-gameplay" ? "Instant gameplay" : "Cheat mode",
			}),
		)
		.with(
			{
				kind: "error",
				action: "exit",
			},
			({ error }): useCheatsModel.Status => ({
				kind: "navigation-error",
				error,
			}),
		)
		.with(
			{
				kind: "error",
			},
			({ action, error }): useCheatsModel.Status => ({
				kind: "error",
				error,
				label: action === "instant-gameplay" ? "Instant gameplay" : "Cheat mode",
			}),
		)
		.with(
			{
				kind: "saved",
			},
			({ action }): useCheatsModel.Status => ({
				kind: "success",
				label: action === "instant-gameplay" ? "Instant gameplay" : "Cheat mode",
			}),
		)
		.exhaustive();

	return {
		blocked: commandState.kind === "pending",
		enabled: cheats.enabled,
		instantGameplay: cheats.instantGameplay,
		status,
		requestExit: (runFx) => {
			runCommand({
				action: "exit",
				runFx,
			});
		},
		setEnabled: (enabled) => {
			runCommand({
				action: "cheat-mode",
				enabled,
			});
		},
		setInstantGameplay: (enabled) => {
			runCommand({
				action: "instant-gameplay",
				enabled,
			});
		},
	};
};
