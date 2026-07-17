import { mutationOptions } from "@tanstack/react-query";

import type { Game } from "~/bridge/game/Game";
import { requestApplicationCloseFx } from "~/bridge/lifecycle/requestApplicationCloseFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Complete mutation contract for saving the exact game through native controlled shutdown. */
export const saveAndExitGameMutationOptions = (game: Game) =>
	mutationOptions({
		mutationKey: [
			"game",
			"save-and-exit",
			game.saveKey.packageId,
			game.saveKey.contentHash,
		] as const,
		mutationFn: () => RendererRuntime.runPromise(requestApplicationCloseFx()),
		retry: false,
	});
