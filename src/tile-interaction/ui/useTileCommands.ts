import { Effect } from "effect";
import { useMemo } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { PlayableGame } from "~/playable-game/type/PlayableGame";
import type { DropItemCommand } from "~/item-interaction/type/DropItemCommand";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import { releaseInventoryItemFx } from "~/item-interaction/fx/releaseInventoryItemFx";
import { splitBoardItemStackFx } from "~/item-interaction/fx/splitBoardItemStackFx";
import {
	activateSpaceItemWithTransitionFx,
	type activateSpaceItemFx,
} from "~/space-action/fx/activateSpaceItemFx";

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
			releaseInventoryItemFn: (command: releaseInventoryItemFx.Props) =>
				RendererRuntime.runPromise(game.runFx(releaseInventoryItemFx(command))),
			runSplitFn: (command: splitBoardItemStackFx.Props) =>
				RendererRuntime.runPromise(
					game.runFx(splitBoardItemStackFx(command)).pipe(
						Effect.as(true),
						Effect.catch(() => Effect.succeed(false)),
					),
				),
			runSpaceActivationFn: (command: activateSpaceItemFx.Props) =>
				RendererRuntime.runPromise(
					game.runFx(activateSpaceItemWithTransitionFx(command)).pipe(
						Effect.map(({ transition }) => ({
							transition,
						})),
						Effect.catch(() => Effect.succeed(null)),
					),
				),
		}),
		[
			game,
		],
	);
