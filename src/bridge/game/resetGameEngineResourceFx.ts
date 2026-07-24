import type { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";

import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { getCachedGameEngineResourceFx } from "~/bridge/game/getCachedGameEngineResourceFx";
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
			Effect.gen(function* () {
				if ((yield* getCachedGameEngineResourceFx(queryClient)) !== resource) {
					return yield* Effect.fail(
						new Error(
							"Game Engine cleanup cannot remove a different or missing singleton resource.",
						),
					);
				}
				return yield* resource.game.disposeWithoutSaveFx.pipe(
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
