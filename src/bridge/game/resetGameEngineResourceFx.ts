import type { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";

import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
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
			resource.game.disposeWithoutSaveFx.pipe(
				Effect.zipRight(
					clearSaveFx ??
						deleteGameSaveFx({
							key: resource.game.saveKey,
						}),
				),
				Effect.tap(() =>
					Effect.sync(() =>
						queryClient.removeQueries({
							exact: true,
							queryKey: gameEngineQueryKey(resource.game.arkpack.packageId),
						}),
					),
				),
			),
		),
);
