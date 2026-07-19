import { mutationOptions } from "@tanstack/react-query";

import type { Game } from "~/bridge/game/Game";
import { requestApplicationCloseFx } from "~/bridge/lifecycle/requestApplicationCloseFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Requests native controlled shutdown; the renderer performs one best-effort final save. */
export const saveAndExitGameMutationOptions = (
	game: Game,
	requestClose: () => Promise<void> = () =>
		RendererRuntime.runPromise(requestApplicationCloseFx()),
) =>
	mutationOptions({
		mutationKey: [
			"game",
			"save-and-exit",
			game.saveKey.packageId,
			game.saveKey.contentHash,
		] as const,
		mutationFn: requestClose,
		retry: false,
	});
