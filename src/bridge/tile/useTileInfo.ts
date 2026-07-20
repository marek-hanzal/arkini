import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readTileInfo } from "~/engine/tile/read/readTileInfo";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace useTileInfo {
	export type Projection =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly title: string;
				readonly subtitle?: string;
				readonly description: string;
				readonly sourceUrl: string;
				readonly compositeUrl?: string;
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies useTileInfo.Projection;

const sameProjection = (left: useTileInfo.Projection, right: useTileInfo.Projection) => {
	if (left.kind !== right.kind) return false;
	if (left.kind === "unavailable" || right.kind === "unavailable") return true;
	return (
		left.itemId === right.itemId &&
		left.title === right.title &&
		left.subtitle === right.subtitle &&
		left.description === right.description &&
		left.sourceUrl === right.sourceUrl &&
		left.compositeUrl === right.compositeUrl
	);
};

/** Projects the minimal live identity and authored visual needed by the Info workspace. */
export const useTileInfo = (itemId: IdSchema.Type): useTileInfo.Projection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useTileInfo.Projection => {
			const info = readTileInfo({
				itemId,
				runtime,
			});
			if (info.kind === "unavailable") return unavailable;
			const subtitle = game.config.categories[info.categoryId]?.title;
			return {
				kind: "available",
				itemId: info.itemId,
				title: info.title,
				...(subtitle === undefined
					? {}
					: {
							subtitle,
						}),
				description: info.description,
				sourceUrl: game.getResourceUrl(info.sourceResourceId),
				...(info.compositeResourceId === undefined
					? {}
					: {
							compositeUrl: game.getResourceUrl(info.compositeResourceId),
						}),
			};
		},
		[
			game,
			itemId,
		],
	);
	return useRuntimeSelector(selector, sameProjection);
};
