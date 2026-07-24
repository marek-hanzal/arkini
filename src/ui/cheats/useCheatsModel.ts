import { match } from "ts-pattern";

import type { Game } from "~/bridge/game/Game";
import { useGameCheats } from "~/bridge/cheat/useGameCheats";
import {
	useSetGameCheatsMutation,
	type useSetGameCheatsMutation as SetGameCheatsMutation,
} from "~/bridge/cheat/useSetGameCheatsMutation";
import { useExclusiveAction } from "~/ui/action/useExclusiveAction";

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
		  };

	export interface Model {
		readonly blocked: boolean;
		readonly enabled: boolean;
		readonly instantGameplay: boolean;
		readonly status: Status;
		readonly setEnabled: (enabled: boolean) => void;
		readonly setInstantGameplay: (enabled: boolean) => void;
	}
}

type CheatsAction = SetGameCheatsMutation.Action;
type CheatsCommand = SetGameCheatsMutation.Command;

const actionLabel = (action: CheatsAction) =>
	match(action)
		.with("cheat-mode", () => "Cheat mode" as const)
		.with("instant-gameplay", () => "Instant gameplay" as const)
		.exhaustive();

/** Owns the one save-scoped Cheats mutation state shared by navigation and presentation. */
export const useCheatsModel = (game: Game): useCheatsModel.Model => {
	const cheats = useGameCheats(game);
	const { active, claim, release } = useExclusiveAction<CheatsAction>();
	const update = useSetGameCheatsMutation(game);
	const settledAction = update.variables?.action;
	let status: useCheatsModel.Status = {
		kind: "idle",
	};
	if (active !== null) {
		status = {
			kind: "pending",
			label: actionLabel(active),
		};
	} else if (update.isError && settledAction !== undefined) {
		status = {
			kind: "error",
			error: update.error,
			label: actionLabel(settledAction),
		};
	} else if (update.isSuccess && settledAction !== undefined) {
		status = {
			kind: "success",
			label: actionLabel(settledAction),
		};
	}

	const mutate = (command: CheatsCommand) => {
		if (!claim(command.action)) return;
		update.mutate(command, {
			onSettled: () => release(command.action),
		});
	};

	return {
		blocked: active !== null,
		enabled: cheats.enabled,
		instantGameplay: cheats.instantGameplay,
		status,
		setEnabled: (enabled) =>
			mutate({
				action: "cheat-mode",
				enabled,
			}),
		setInstantGameplay: (enabled) =>
			mutate({
				action: "instant-gameplay",
				enabled,
			}),
	};
};
