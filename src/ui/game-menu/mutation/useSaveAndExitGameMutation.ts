import { useMutation } from "@tanstack/react-query";

import type { Game } from "~/bridge/game/Game";
import { useGameOwner } from "~/bridge/game/useGameOwner";
import { saveAndExitGameMutationOptions } from "~/ui/game-menu/mutation/saveAndExitGameMutationOptions";

/** Runs one exact game's complete safe route-release mutation contract. */
export const useSaveAndExitGameMutation = (game: Game) => {
	const owner = useGameOwner();
	return useMutation(
		saveAndExitGameMutationOptions({
			game,
			owner,
		}),
	);
};
