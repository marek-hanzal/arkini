import { Effect } from "effect";
import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { readRuntimeItemPrimaryAssetId } from "~/engine/item/read/readRuntimeItemPrimaryAssetId";
import { readTileStatusFx } from "~/engine/tile/read/readTileStatusFx";

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
		readonly running: boolean;
	}
}

/** Projects every live grid item for the one Canvas-wide stable actor layer. */
export const useTileActors = (): ReadonlyArray<useTileActors.Item> => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): ReadonlyArray<useTileActors.Item> => {
			const activeOwnerIds = new Set(runtime.jobs.map((job) => job.ownerItemId));
			return runtime.items.filter(isGridRuntimeItem).map((item) => {
				const status =
					!activeOwnerIds.has(item.id) || !isLineOwnerItem(item.item)
						? undefined
						: Effect.runSync(
								readTileStatusFx({
									itemId: item.id,
									runtime,
								}),
							);
				return {
					id: item.id,
					revision: item.revision,
					itemId: item.item.id,
					title: item.item.title,
					quantity: item.quantity,
					location: item.location,
					running: status?.kind === "available" && status.state.kind === "working",
					sourceUrl: game.getResourceUrl(
						readRuntimeItemPrimaryAssetId(runtime, item.item),
					),
					...(item.item.asset.composite === undefined
						? {}
						: {
								compositeUrl: game.getResourceUrl(item.item.asset.composite),
							}),
				};
			});
		},
		[
			game,
		],
	);

	return useRuntimeSelector(selector);
};
