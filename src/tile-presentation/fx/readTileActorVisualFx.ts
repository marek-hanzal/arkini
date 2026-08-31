import { Effect } from "effect";

import type { GameEngine } from "~/renderer/game/GameEngine";
import type { TileActorVisual } from "~/tile-presentation/type/TileActorVisual";
import type { AssetSchema } from "~/item-definition/schema/AssetSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

/** Projects the immutable face of one canonical item for retained renderer motion. */
export const readTileActorVisualFx = Effect.fn("readTileActorVisualFx")(function* ({
	game,
	item,
	sourceIds: requestedSourceIds,
}: {
	readonly game: Pick<GameEngine, "getResourceUrl">;
	readonly item: ItemSchema.Type;
	readonly sourceIds?: AssetSchema.Type["default"];
}) {
	const sourceIds = requestedSourceIds ?? item.asset.default;
	return {
		itemId: item.id,
		title: item.title,
		sourceUrl: game.getResourceUrl(sourceIds[0]),
		...(sourceIds[1] === undefined
			? {}
			: {
					compositeUrl: game.getResourceUrl(sourceIds[1]),
				}),
	} satisfies TileActorVisual;
});
