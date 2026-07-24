import type { QueryClient } from "@tanstack/react-query";

import { isGameEngineAcquisitionPending } from "~/bridge/game/GameEngineAcquisitionOwnership";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";

/** Reads the one published renderer-wide Game Engine resource, if one exists. */
export const getCachedGameEngineResource = (
	queryClient: QueryClient,
): GameEngineResource | null => {
	if (isGameEngineAcquisitionPending(queryClient)) return null;
	const resource = queryClient.getQueryData<GameEngineResource>(gameEngineQueryKey);
	return resource ?? null;
};
