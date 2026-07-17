import { useMutation } from "@tanstack/react-query";

import type { Game } from "~/bridge/game/Game";
import { useGameOwner } from "~/bridge/game/useGameOwner";
import { hardResetGameMutationOptions } from "~/ui/game-menu/mutation/hardResetGameMutationOptions";

/** Runs one exact game's complete destructive hard-reset mutation contract. */
export const useHardResetGameMutation = (game: Game) => {
	const owner = useGameOwner();
	return useMutation(
		hardResetGameMutationOptions({
			game,
			owner,
		}),
	);
};
