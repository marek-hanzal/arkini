import type { QueryClient } from "@tanstack/react-query";

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
	if (query.state.data !== undefined) return query.state.data;
	if (query.promise === undefined) return null;
	return query.promise.catch(() => null);
};
