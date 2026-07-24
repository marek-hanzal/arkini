import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { readRuntimeItemPrimaryAssetIdFx } from "~/engine/item/read/readRuntimeItemPrimaryAssetIdFx";
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
	const sourceAssetId = yield* readRuntimeItemPrimaryAssetIdFx({
		item: configured,
	});
	return {
		itemId: item.itemId,
		title: configured.title,
		quantity: item.quantity,
		sourceUrl: game.getResourceUrl(sourceAssetId),
		...(configured.asset.composite === undefined
			? {}
			: {
					compositeUrl: game.getResourceUrl(configured.asset.composite),
				}),
		definitionItemId: configured.id,
	} satisfies projectItemDetailOutputItemFx.Result;
});
