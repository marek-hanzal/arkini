import { mutationOptions } from "@tanstack/react-query";

import type { Game } from "~/bridge/game/Game";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Complete TanStack mutation contract for one explicit durable save flush. */
export const saveGameMutationOptions = (game: Game) =>
	mutationOptions({
		mutationKey: [
			"game",
			"save",
			game.saveKey.packageId,
			game.saveKey.contentHash,
		] as const,
		mutationFn: () => RendererRuntime.runPromise(game.flushSaveFx),
		retry: false,
	});
