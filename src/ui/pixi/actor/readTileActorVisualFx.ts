import { Effect } from "effect";

import type { GameEngine } from "~/renderer/game/GameEngine";
import type { TileActorVisual } from "~/ui/pixi/actor/TileActorVisual";
import type { AssetSchema } from "~/item-definition/schema/AssetSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

export namespace readTileActorVisualFx {
	export interface Props {
		readonly game: GameEngine;
		readonly item: ItemSchema.Type;
		readonly sourceIds?: AssetSchema.Type["default"];
	}
}

/** Projects the immutable face of one canonical item for retained renderer motion. */
export const readTileActorVisualFx = Effect.fn("readTileActorVisualFx")(function* ({
	game,
	item,
	sourceIds: requestedSourceIds,
}: readTileActorVisualFx.Props) {
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
