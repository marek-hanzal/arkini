import { useMutation } from "@tanstack/react-query";

import type { Game } from "~/bridge/game/Game";
import { saveAndExitGameMutationOptions } from "~/ui/game-menu/mutation/saveAndExitGameMutationOptions";

/** Requests native controlled shutdown; the close route owns final save presentation. */
export const useSaveAndExitGameMutation = (game: Game) =>
	useMutation(saveAndExitGameMutationOptions(game));
