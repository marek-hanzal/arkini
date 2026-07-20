import type { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";

import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { getCachedGameEngineResource } from "~/bridge/game/getCachedGameEngineResource";
import { removeGameEngineResource } from "~/bridge/game/removeGameEngineResource";
import { deleteGameSaveFx } from "~/bridge/save/deleteGameSaveFx";

export namespace resetGameEngineResourceFx {
	export interface Props {
		readonly clearSaveFx?: Effect.Effect<void, unknown>;
		readonly queryClient: QueryClient;
		readonly resource: GameEngineResource;
	}
}

/** Discards one route-owned Game, clears its exact save and removes the spent resource. */
export const resetGameEngineResourceFx = Effect.fn("resetGameEngineResourceFx")(
	({ clearSaveFx, queryClient, resource }: resetGameEngineResourceFx.Props) =>
		resource.withLifecycleLockFx(
			Effect.suspend(() => {
				if (getCachedGameEngineResource(queryClient) !== resource) {
					return Effect.fail(
						new Error(
							"Game Engine cleanup cannot remove a different or missing singleton resource.",
						),
					);
				}
				return resource.game.disposeWithoutSaveFx.pipe(
					Effect.zipRight(
						clearSaveFx ??
							deleteGameSaveFx({
								key: resource.game.saveKey,
							}),
					),
					Effect.tap(() =>
						Effect.sync(() =>
							removeGameEngineResource({
								queryClient,
								resource,
							}),
						),
					),
				);
			}),
		),
);
