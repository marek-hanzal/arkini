import { useMutation } from "@tanstack/react-query";

import type { Game } from "~/bridge/game/Game";
import { saveGameMutationOptions } from "~/ui/game-menu/mutation/saveGameMutationOptions";

/** Runs one exact game's complete explicit-save mutation contract. */
export const useSaveGameMutation = (game: Game) => useMutation(saveGameMutationOptions(game));
