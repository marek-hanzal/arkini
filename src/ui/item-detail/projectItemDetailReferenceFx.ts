import { Effect } from "effect";

import type { GameEngine } from "~/renderer/game/GameEngine";
import type { ItemDetailLines } from "~/ui/item-detail/ItemDetailLines";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readRuntimeItemDefaultAssetIdsFx } from "~/engine/item/read/readRuntimeItemDefaultAssetIdsFx";
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
	const sourceAssetIds = yield* readRuntimeItemDefaultAssetIdsFx({
		item: configured,
	});
	return {
		itemId,
		title: configured.title,
		sourceUrl: game.getResourceUrl(sourceAssetIds[0]),
		...(sourceAssetIds[1] === undefined
			? {}
			: {
					compositeUrl: game.getResourceUrl(sourceAssetIds[1]),
				}),
		...(live === undefined
			? {}
			: {
					detailItemId: live.id,
				}),
	} satisfies projectItemDetailReferenceFx.Result;
});
