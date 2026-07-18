import { useMutation } from "@tanstack/react-query";

import type { Game } from "~/bridge/game/Game";
import { requestApplicationCloseFx } from "~/bridge/lifecycle/requestApplicationCloseFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { saveAndExitGameMutationOptions } from "~/ui/game-menu/mutation/saveAndExitGameMutationOptions";
import { useActionLoading } from "~/ui/loading/useActionLoading";

/** Runs the exact game's complete native save-and-exit mutation contract. */
export const useSaveAndExitGameMutation = (game: Game) => {
	const { runNativeClose } = useActionLoading();
	return useMutation(
		saveAndExitGameMutationOptions(game, () =>
			runNativeClose({
				action: () => RendererRuntime.runPromise(requestApplicationCloseFx()),
				key: "native-close:save-and-exit",
				label: "Saving and exiting Arkini…",
			}),
		),
	);
};
