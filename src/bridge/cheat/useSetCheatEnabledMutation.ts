import { useMutation } from "@tanstack/react-query";

import type { Game } from "~/bridge/game/Game";
import { setCheatEnabledFx } from "~/engine/cheat/write/setCheatEnabledFx";

/** Mutates persisted Cheat mode on one already active Game. */
export const useSetCheatEnabledMutation = (game: Game) =>
	useMutation({
		mutationKey: [
			"game",
			"cheats",
			"enabled",
			game.saveKey.packageId,
			game.saveKey.contentHash,
		],
		mutationFn: (enabled: boolean) =>
			game.run(
				setCheatEnabledFx({
					enabled,
				}),
			),
		retry: false,
	});
