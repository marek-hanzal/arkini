import { useMutation } from "@tanstack/react-query";

import type { Game } from "~/bridge/game/Game";
import { spawnCheatItemFx } from "~/engine/cheat/write/spawnCheatItemFx";

/** Executes one authorized canonical Cheat Spotlight spawn. */
export const useSpawnCheatItemMutation = (game: Game) =>
	useMutation({
		mutationKey: [
			"game",
			"cheats",
			"spawn-item",
			game.saveKey.packageId,
			game.saveKey.contentHash,
		],
		mutationFn: (itemId: string) =>
			game.run(
				spawnCheatItemFx({
					itemId,
				}),
			),
		retry: false,
	});
