import type { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";

import { gameEngineAcquisitionOwners } from "~/bridge/game/gameEngineAcquisitionOwners";

/** Reads whether the sole renderer Game Engine owner is still provisional or terminal-critical. */
export const isGameEngineAcquisitionPendingFx = Effect.fn("isGameEngineAcquisitionPendingFx")(
	(queryClient: QueryClient) => Effect.sync(() => gameEngineAcquisitionOwners.has(queryClient)),
);
