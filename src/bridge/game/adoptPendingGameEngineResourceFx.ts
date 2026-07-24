import type { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";

import { gameEngineAcquisitionOwners } from "~/bridge/game/gameEngineAcquisitionOwners";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";

/** Transfers a pending route acquisition to a native-close or HMR lifecycle owner. */
export const adoptPendingGameEngineResourceFx = Effect.fn("adoptPendingGameEngineResourceFx")(
	(queryClient: QueryClient, resource: GameEngineResource) =>
		Effect.try({
			try: () => {
				const owner = gameEngineAcquisitionOwners.get(queryClient);
				if (owner?.criticalFailure !== undefined) throw owner.criticalFailure;
				if (
					owner !== undefined &&
					owner.cancelling === undefined &&
					queryClient.getQueryData<GameEngineResource>(gameEngineQueryKey) === resource
				) {
					owner.adopted = true;
					if (gameEngineAcquisitionOwners.get(queryClient) === owner) {
						gameEngineAcquisitionOwners.delete(queryClient);
					}
					for (const consumer of owner.consumers) consumer.removeAbortListener();
					owner.consumers.clear();
				}
				return resource;
			},
			catch: (cause) => cause,
		}),
);
