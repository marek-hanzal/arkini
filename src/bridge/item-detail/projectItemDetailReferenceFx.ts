import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readRuntimeItemPrimaryAssetIdFx } from "~/engine/item/read/readRuntimeItemPrimaryAssetIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace projectItemDetailReferenceFx {
	export interface Props {
		readonly game: GameEngine;
		readonly itemId: IdSchema.Type;
		readonly preferredRuntimeItemIds?: readonly IdSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}

	export type Result = ItemDetailLines.DetailReference | undefined;
}

/** Projects one configured item and its preferred live identity into an Item Detail reference. */
export const projectItemDetailReferenceFx = Effect.fn("projectItemDetailReferenceFx")(function* ({
	game,
	itemId,
	preferredRuntimeItemIds = [],
	runtime,
}: projectItemDetailReferenceFx.Props) {
	const configured = game.config.items[itemId];
	if (configured === undefined) return undefined;
	const live = preferredRuntimeItemIds
		.map((runtimeItemId) => runtime.items.find((candidate) => candidate.id === runtimeItemId))
		.find((candidate) => candidate?.item.id === itemId);
	const sourceAssetId = yield* readRuntimeItemPrimaryAssetIdFx({
		item: configured,
	});
	return {
		itemId,
		title: configured.title,
		sourceUrl: game.getResourceUrl(sourceAssetId),
		...(configured.asset.composite === undefined
			? {}
			: {
					compositeUrl: game.getResourceUrl(configured.asset.composite),
				}),
		...(live === undefined
			? {}
			: {
					detailItemId: live.id,
				}),
	} satisfies projectItemDetailReferenceFx.Result;
});
