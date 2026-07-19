import type { QueryClient } from "@tanstack/react-query";

import type { Game } from "~/bridge/game/Game";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { gameEngineQueryRootKey } from "~/bridge/game/gameEngineQueryKey";

export interface CachedGameEngine {
	readonly game: Game;
	readonly packageId: string;
	readonly resource: GameEngineResource;
}

/** Resolves the sole cached live Game and rejects an impossible multi-engine renderer state. */
export const findCachedGameEngine = (queryClient: QueryClient): CachedGameEngine | null => {
	const cached = queryClient
		.getQueriesData<GameEngineResource>({
			queryKey: gameEngineQueryRootKey,
		})
		.flatMap(([queryKey, resource]) => {
			if (resource === undefined) return [];
			const packageId = queryKey[1];
			if (typeof packageId !== "string") {
				throw new Error("Cached Game query is missing its package identity.");
			}
			return [
				{
					game: resource.game,
					packageId,
					resource,
				} satisfies CachedGameEngine,
			];
		});
	if (cached.length > 1) {
		throw new Error("Arkini cannot own more than one cached live Game.");
	}
	return cached[0] ?? null;
};
