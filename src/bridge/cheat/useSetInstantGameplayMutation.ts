import { useMutation } from "@tanstack/react-query";

import type { Game } from "~/bridge/game/Game";
import { setInstantGameplayFx } from "~/engine/cheat/write/setInstantGameplayFx";

/** Mutates the persisted Instant gameplay option on one exact active Game. */
export const useSetInstantGameplayMutation = (game: Game) =>
	useMutation({
		mutationKey: [
			"game",
			"cheats",
			"instant-gameplay",
			game.saveKey.packageId,
			game.saveKey.contentHash,
		],
		mutationFn: (enabled: boolean) =>
			game.run(
				setInstantGameplayFx({
					enabled,
				}),
			),
		retry: false,
	});
