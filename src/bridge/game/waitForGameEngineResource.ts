import type { QueryClient } from "@tanstack/react-query";

import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import { adoptPendingGameEngineResource } from "~/bridge/game/acquireGameEngineResource";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";

/** Joins the sole published or currently creating Game Engine resource. */
export const waitForGameEngineResource = async (
	queryClient: QueryClient,
): Promise<GameEngineResource | null> => {
	const query = queryClient.getQueryCache().find<GameEngineResource>({
		exact: true,
		queryKey: gameEngineQueryKey,
	});
	if (query === undefined) return null;
	if (query.state.data !== undefined) {
		return adoptPendingGameEngineResource(queryClient, query.state.data);
	}
	if (query.promise === undefined) return null;
	return query.promise
		.then((resource) => adoptPendingGameEngineResource(queryClient, resource))
		.catch((cause) => {
			if (cause instanceof CriticalGameLifecycleError) throw cause;
			return null;
		});
};
