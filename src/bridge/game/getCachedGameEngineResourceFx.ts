import type { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";

import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import { isGameEngineAcquisitionPendingFx } from "~/bridge/game/isGameEngineAcquisitionPendingFx";

/** Reads the one published renderer-wide Game Engine resource, if one exists. */
export const getCachedGameEngineResourceFx = Effect.fn("getCachedGameEngineResourceFx")(function* (
	queryClient: QueryClient,
) {
	if (yield* isGameEngineAcquisitionPendingFx(queryClient)) return null;
	const resource = queryClient.getQueryData<GameEngineResource>(gameEngineQueryKey);
	return resource ?? null;
});
