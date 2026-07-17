import { useMutation } from "@tanstack/react-query";

import type { Game } from "~/bridge/game/Game";
import { saveAndExitGameMutationOptions } from "~/ui/game-menu/mutation/saveAndExitGameMutationOptions";

/** Runs the exact game's complete native save-and-exit mutation contract. */
export const useSaveAndExitGameMutation = (game: Game) =>
	useMutation(saveAndExitGameMutationOptions(game));
