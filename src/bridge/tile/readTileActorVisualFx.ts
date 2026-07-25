import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { TileActorVisual } from "~/bridge/tile/TileActorVisual";
import { readRuntimeItemPrimaryAssetIdFx } from "~/engine/item/read/readRuntimeItemPrimaryAssetIdFx";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";

/** Projects the immutable face of one canonical item for retained renderer motion. */
export const readTileActorVisualFx = Effect.fn("readTileActorVisualFx")(function* ({
	game,
	item,
}: {
	readonly game: GameEngine;
	readonly item: ItemSchema.Type;
}) {
	const primaryAssetId = yield* readRuntimeItemPrimaryAssetIdFx({
		item,
	});
	return {
		itemId: item.id,
		title: item.title,
		sourceUrl: game.getResourceUrl(primaryAssetId),
		...(item.asset.composite === undefined
			? {}
			: {
					compositeUrl: game.getResourceUrl(item.asset.composite),
				}),
	} satisfies TileActorVisual;
});
