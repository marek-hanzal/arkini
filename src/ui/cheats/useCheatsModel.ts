import { match } from "ts-pattern";

import type { Game } from "~/bridge/game/Game";
import { useGameCheats } from "~/bridge/cheat/useGameCheats";
import { useSetCheatEnabledMutation } from "~/bridge/cheat/useSetCheatEnabledMutation";
import { useSetInstantGameplayMutation } from "~/bridge/cheat/useSetInstantGameplayMutation";
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
		readonly beginExit: () => boolean;
		readonly completeExit: () => void;
		readonly setEnabled: (enabled: boolean) => void;
		readonly setInstantGameplay: (enabled: boolean) => void;
	}
}

type CheatsAction = "cheat-mode" | "instant-gameplay" | "exit";

const actionLabel = (action: Exclude<CheatsAction, "exit">) =>
	match(action)
		.with("cheat-mode", () => "Cheat mode" as const)
		.with("instant-gameplay", () => "Instant gameplay" as const)
		.exhaustive();

/** Owns the one save-scoped Cheats mutation state shared by navigation and presentation. */
export const useCheatsModel = (game: Game): useCheatsModel.Model => {
	const cheats = useGameCheats(game);
	const { active, claim, release } = useExclusiveAction<CheatsAction>();
	const setCheatEnabled = useSetCheatEnabledMutation(game);
	const setInstantGameplay = useSetInstantGameplayMutation(game);
	let status: useCheatsModel.Status = {
		kind: "idle",
	};
	if (active === "cheat-mode" || active === "instant-gameplay") {
		status = {
			kind: "pending",
			label: actionLabel(active),
		};
	} else if (setCheatEnabled.isError) {
		status = {
			kind: "error",
			error: setCheatEnabled.error,
			label: "Cheat mode",
		};
	} else if (setInstantGameplay.isError) {
		status = {
			kind: "error",
			error: setInstantGameplay.error,
			label: "Instant gameplay",
		};
	} else if (setCheatEnabled.isSuccess) {
		status = {
			kind: "success",
			label: "Cheat mode",
		};
	} else if (setInstantGameplay.isSuccess) {
		status = {
			kind: "success",
			label: "Instant gameplay",
		};
	}

	return {
		blocked: active !== null,
		enabled: cheats.enabled,
		instantGameplay: cheats.instantGameplay,
		status,
		beginExit: () => claim("exit"),
		completeExit: () => release("exit"),
		setEnabled: (enabled) => {
			if (!claim("cheat-mode")) return;
			setInstantGameplay.reset();
			setCheatEnabled.mutate(enabled, {
				onSettled: () => release("cheat-mode"),
			});
		},
		setInstantGameplay: (enabled) => {
			if (!claim("instant-gameplay")) return;
			setCheatEnabled.reset();
			setInstantGameplay.mutate(enabled, {
				onSettled: () => release("instant-gameplay"),
			});
		},
	};
};
