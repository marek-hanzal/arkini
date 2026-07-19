import type { QueryClient } from "@tanstack/react-query";

import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";

/** Reads the one published renderer-wide Game Engine resource, if one exists. */
export const getCachedGameEngineResource = (queryClient: QueryClient): GameEngineResource | null =>
	queryClient.getQueryData<GameEngineResource>(gameEngineQueryKey) ?? null;
