import { useMutation } from "@tanstack/react-query";

import type { Game } from "~/bridge/game/Game";
import { setCheatEnabledFx } from "~/engine/cheat/write/setCheatEnabledFx";

/** Mutates persisted Cheat mode on one already active Game. */
export const useSetCheatEnabledMutation = (game: Game | null) =>
	useMutation({
		mutationKey: [
			"game",
			"cheats",
			"enabled",
			game?.saveKey.packageId ?? "none",
			game?.saveKey.contentHash ?? "none",
		],
		mutationFn: async (enabled: boolean) => {
			if (game === null) throw new Error("No active Game is available.");
			return game.run(
				setCheatEnabledFx({
					enabled,
				}),
			);
		},
		retry: false,
	});
