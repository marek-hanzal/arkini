import type { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";

import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { getCachedGameEngineResourceFx } from "~/bridge/game/getCachedGameEngineResourceFx";
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
			Effect.gen(function* () {
				const currentResource = yield* getCachedGameEngineResourceFx(queryClient);
				if (currentResource === null && allowAlreadyFinalized) return;
				if (currentResource !== resource) {
					return yield* Effect.fail(
						new Error(
							"Game Engine cleanup cannot remove a different or missing singleton resource.",
						),
					);
				}
				return yield* resource.game.disposeFx.pipe(
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
