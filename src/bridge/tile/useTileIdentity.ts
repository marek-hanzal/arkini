import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { TileItemId } from "~/bridge/tile/TileItemId";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { readTileIdentity } from "~/engine/tile/read/readTileIdentity";

export namespace useTileIdentity {
	export type Projection =
		| {
				readonly kind: "available";
				readonly itemId: TileItemId;
				readonly title: string;
				readonly subtitle?: string;
				readonly sourceUrl: string;
				readonly compositeUrl?: string;
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies useTileIdentity.Projection;

const sameProjection = (left: useTileIdentity.Projection, right: useTileIdentity.Projection) => {
	if (left.kind !== right.kind) return false;
	if (left.kind === "unavailable" || right.kind === "unavailable") return true;
	return (
		left.itemId === right.itemId &&
		left.title === right.title &&
		left.subtitle === right.subtitle &&
		left.sourceUrl === right.sourceUrl &&
		left.compositeUrl === right.compositeUrl
	);
};

/** Resolves the shared live identity rendered by every tile capability workspace. */
export const useTileIdentity = (itemId: TileItemId): useTileIdentity.Projection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useTileIdentity.Projection => {
			const identity = readTileIdentity({
				itemId,
				runtime,
			});
			if (identity.kind === "unavailable") return unavailable;
			const subtitle = game.config.categories[identity.categoryId]?.title;
			return {
				kind: "available",
				itemId: identity.itemId,
				title: identity.title,
				...(subtitle === undefined
					? {}
					: {
							subtitle,
						}),
				sourceUrl: game.getResourceUrl(identity.sourceResourceId),
				...(identity.compositeResourceId === undefined
					? {}
					: {
							compositeUrl: game.getResourceUrl(identity.compositeResourceId),
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
