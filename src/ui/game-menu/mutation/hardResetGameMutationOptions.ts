import { mutationOptions } from "@tanstack/react-query";

import type { Game } from "~/bridge/game/Game";
import type { GameOwner } from "~/bridge/game/GameOwner";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Complete TanStack mutation contract for the canonical destructive hard reset. */
export const hardResetGameMutationOptions = ({
	game,
	owner,
}: {
	readonly game: Game;
	readonly owner: GameOwner;
}) =>
	mutationOptions({
		mutationKey: [
			"game",
			"hard-reset",
			game.saveKey.packageId,
			game.saveKey.contentHash,
		] as const,
		mutationFn: () => RendererRuntime.runPromise(owner.hardResetFx()),
		retry: false,
	});
