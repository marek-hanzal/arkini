import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace useTileActors {
	export interface Item {
		readonly id: string;
		readonly revision: string;
		readonly itemId: string;
		readonly title: string;
		readonly quantity: number;
		readonly sourceUrl: string;
		readonly compositeUrl?: string;
		readonly location: GridLocationSchema.Type;
	}
}

const readPrimaryAssetId = (
	runtime: RuntimeSchema.Type,
	item: RuntimeSchema.Type["items"][number]["item"],
) => {
	if (item.type === "cheat:speed") {
		return item.asset.source[runtime.session.speedMode === "accelerated" ? 0 : 1];
	}
	return item.asset.source[0];
};

/** Projects every live grid item for the one Canvas-wide stable actor layer. */
export const useTileActors = (): ReadonlyArray<useTileActors.Item> => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): ReadonlyArray<useTileActors.Item> =>
			runtime.items.filter(isGridRuntimeItem).map((item) => ({
				id: item.id,
				revision: item.revision,
				itemId: item.item.id,
				title: item.item.title,
				quantity: item.quantity,
				location: item.location,
				sourceUrl: game.getResourceUrl(readPrimaryAssetId(runtime, item.item)),
				...(item.item.asset.composite === undefined
					? {}
					: {
							compositeUrl: game.getResourceUrl(item.item.asset.composite),
						}),
			})),
		[
			game,
		],
	);

	return useRuntimeSelector(selector);
};
