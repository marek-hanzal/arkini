import type { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";

import { adoptPendingGameEngineResourceFx } from "~/bridge/game/adoptPendingGameEngineResourceFx";
import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";

/** Joins the sole published or currently creating Game Engine resource. */
export const waitForGameEngineResourceFx = Effect.fn("waitForGameEngineResourceFx")(
	(queryClient: QueryClient) =>
		Effect.suspend(() => {
			const query = queryClient.getQueryCache().find<GameEngineResource>({
				exact: true,
				queryKey: gameEngineQueryKey,
			});
			if (query === undefined) return Effect.succeed(null);
			if (query.state.data !== undefined) {
				return adoptPendingGameEngineResourceFx(queryClient, query.state.data);
			}
			if (query.promise === undefined) return Effect.succeed(null);
			return Effect.tryPromise({
				try: () => query.promise as Promise<GameEngineResource>,
				catch: (cause) => cause,
			}).pipe(
				Effect.flatMap((resource) =>
					adoptPendingGameEngineResourceFx(queryClient, resource),
				),
				Effect.catchAll((cause) =>
					cause instanceof CriticalGameLifecycleError
						? Effect.fail(cause)
						: Effect.succeed(null),
				),
			);
		}),
);
