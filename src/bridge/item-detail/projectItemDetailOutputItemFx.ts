import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { readRuntimeItemDefaultAssetIdsFx } from "~/engine/item/read/readRuntimeItemDefaultAssetIdsFx";
import type { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";

export namespace projectItemDetailOutputItemFx {
	export interface Props {
		readonly game: GameEngine;
		readonly item: readItemDetailLinesFx.OutputItem;
	}

	export type Result = ItemDetailLines.OutputItem;
}

/** Projects one authored output item into its renderer artwork and definition target. */
export const projectItemDetailOutputItemFx = Effect.fn("projectItemDetailOutputItemFx")(function* ({
	game,
	item,
}: projectItemDetailOutputItemFx.Props) {
	const configured = game.config.items[item.itemId];
	if (configured === undefined) {
		return {
			itemId: item.itemId,
			title: item.itemId,
			quantity: item.quantity,
		} satisfies projectItemDetailOutputItemFx.Result;
	}
	const sourceAssetIds = yield* readRuntimeItemDefaultAssetIdsFx({
		item: configured,
	});
	return {
		itemId: item.itemId,
		title: configured.title,
		quantity: item.quantity,
		sourceUrl: game.getResourceUrl(sourceAssetIds[0]),
		...(sourceAssetIds[1] === undefined
			? {}
			: {
					compositeUrl: game.getResourceUrl(sourceAssetIds[1]),
				}),
		definitionItemId: configured.id,
	} satisfies projectItemDetailOutputItemFx.Result;
});
