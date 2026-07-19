import type { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";

import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { removeGameEngineResource } from "~/bridge/game/removeGameEngineResource";

export namespace releaseGameEngineResourceFx {
	export interface Props {
		readonly queryClient: QueryClient;
		readonly resource: GameEngineResource;
	}
}

/** Final-saves one route-owned Game and removes its resource only after success. */
export const releaseGameEngineResourceFx = Effect.fn("releaseGameEngineResourceFx")(
	({ queryClient, resource }: releaseGameEngineResourceFx.Props) =>
		resource.withLifecycleLockFx(
			resource.game.disposeFx.pipe(
				Effect.tap(() =>
					Effect.sync(() =>
						removeGameEngineResource({
							queryClient,
							resource,
						}),
					),
				),
			),
		),
);
