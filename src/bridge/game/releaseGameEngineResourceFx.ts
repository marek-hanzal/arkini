import type { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";

import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { getCachedGameEngineResource } from "~/bridge/game/getCachedGameEngineResource";
import { removeGameEngineResource } from "~/bridge/game/removeGameEngineResource";

export namespace releaseGameEngineResourceFx {
	export interface Props {
		/** Native close/HMR only: another successful terminal action may already have removed this resource. */
		readonly allowAlreadyFinalized?: boolean;
		readonly queryClient: QueryClient;
		readonly resource: GameEngineResource;
	}
}

/** Final-saves one owned Game and removes its singleton resource only after success. */
export const releaseGameEngineResourceFx = Effect.fn("releaseGameEngineResourceFx")(
	({ allowAlreadyFinalized = false, queryClient, resource }: releaseGameEngineResourceFx.Props) =>
		resource.withLifecycleLockFx(
			Effect.suspend(() => {
				const currentResource = getCachedGameEngineResource(queryClient);
				if (currentResource === null && allowAlreadyFinalized) return Effect.void;
				if (currentResource !== resource) {
					return Effect.fail(
						new Error(
							"Game Engine cleanup cannot remove a different or missing singleton resource.",
						),
					);
				}
				return resource.game.disposeFx.pipe(
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
