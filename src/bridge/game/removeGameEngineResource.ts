import type { QueryClient } from "@tanstack/react-query";

import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";

/** Removes the singleton query only when it still publishes the exact spent resource. */
export const removeGameEngineResource = ({
	queryClient,
	resource,
}: {
	readonly queryClient: QueryClient;
	readonly resource: GameEngineResource;
}): void => {
	if (queryClient.getQueryData<GameEngineResource>(gameEngineQueryKey) !== resource) {
		throw new Error(
			"Game Engine cleanup cannot remove a different or missing singleton resource.",
		);
	}
	queryClient.removeQueries({
		exact: true,
		queryKey: gameEngineQueryKey,
	});
};
