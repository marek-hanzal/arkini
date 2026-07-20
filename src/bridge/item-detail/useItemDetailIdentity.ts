import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { readItemDetailIdentity } from "~/engine/item-detail/read/readItemDetailIdentity";

export namespace useItemDetailIdentity {
	export type Projection =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
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
} as const satisfies useItemDetailIdentity.Projection;

const sameProjection = (
	left: useItemDetailIdentity.Projection,
	right: useItemDetailIdentity.Projection,
) => {
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

/** Resolves the shared live identity rendered by the shared Item Detail header. */
export const useItemDetailIdentity = (itemId: IdSchema.Type): useItemDetailIdentity.Projection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailIdentity.Projection => {
			const identity = readItemDetailIdentity({
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
