import { Effect } from "effect";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** Artwork-backed navigation identity for one configured Item and an optional exact live target. */
export interface ItemDetailReference {
	readonly itemId: string;
	readonly title: string;
	readonly sourceUrl: string;
	readonly compositeUrl?: string;
	readonly detailItemId?: string;
}

interface ProjectItemDetailReferenceProps {
	readonly game: GameEngine;
	readonly itemId: IdSchema.Type;
	readonly preferredRuntimeItemIds?: readonly IdSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}

/** Projects one configured item and its preferred live identity into an Item Detail reference. */
export const projectItemDetailReferenceFx = Effect.fn("projectItemDetailReferenceFx")(function* ({
	game,
	itemId,
	preferredRuntimeItemIds = [],
	runtime,
}: ProjectItemDetailReferenceProps) {
	const configured = game.config.items[itemId];
	if (configured === undefined) return undefined;
	const live = preferredRuntimeItemIds
		.map((runtimeItemId) => runtime.items.find((candidate) => candidate.id === runtimeItemId))
		.find((candidate) => candidate?.item.id === itemId);
	const sourceAssetIds = configured.asset.default;
	return {
		itemId,
		title: configured.title,
		sourceUrl: game.getResourceUrlFn(sourceAssetIds[0]),
		...(sourceAssetIds[1] === undefined
			? {}
			: {
					compositeUrl: game.getResourceUrlFn(sourceAssetIds[1]),
				}),
		...(live === undefined
			? {}
			: {
					detailItemId: live.id,
				}),
	} satisfies ItemDetailReference;
});
