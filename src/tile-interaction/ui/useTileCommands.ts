import { useMemo } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { PlayableGame } from "~/playable-game/type/PlayableGame";
import type { DropItemCommand } from "~/item-interaction/type/DropItemCommand";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";

/**
 * Binds gestures to one exact Game with an independent Promise for every submission.
 * The Game owns admitted command lifetime; scene teardown only suppresses stale presentation.
 * Shared concurrent Atom results cannot correlate overlapping commands with their own callers.
 */
export const useTileCommands = (game: PlayableGame) =>
	useMemo(
		() => ({
			runDropFn: (command: DropItemCommand) =>
				RendererRuntime.runPromise(game.runFx(dropItemFx(command))),
		}),
		[
			game,
		],
	);
