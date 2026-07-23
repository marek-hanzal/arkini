import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { readTileActorsFx } from "~/bridge/tile/readTileActorsFx";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace useTileActors {
	export type Item = TileActorItem;
}

/** Projects every live grid item for ordinary consumers outside transition choreography. */
export const useTileActors = (): ReadonlyArray<useTileActors.Item> => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type) =>
			game.readOrThrow(
				readTileActorsFx({
					game,
					runtime,
				}),
			),
		[
			game,
		],
	);

	return useRuntimeSelector(selector);
};
