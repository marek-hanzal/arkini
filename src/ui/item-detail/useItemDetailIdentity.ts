import { Equal } from "effect";
import { useCallback } from "react";

import { useGameEngine } from "~/ui/game/useGameEngine";
import { useRuntimeSelector } from "~/ui/game/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { readItemDetailIdentityFx } from "~/engine/item-detail/read/readItemDetailIdentityFx";

export namespace useItemDetailIdentity {
	export type Projection =
		| {
				readonly kind: "available";
				readonly definitionId: IdSchema.Type;
				readonly itemId: IdSchema.Type;
				readonly title: string;
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

/** Resolves the shared live identity rendered by the shared Item Detail header. */
export const useItemDetailIdentity = (itemId: IdSchema.Type): useItemDetailIdentity.Projection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailIdentity.Projection => {
			const identity = game.readOrThrow(
				readItemDetailIdentityFx({
					itemId,
					runtime,
				}),
			);
			if (identity.kind === "unavailable") return unavailable;
			return {
				kind: "available",
				definitionId: identity.definitionId,
				itemId: identity.itemId,
				title: identity.title,
				sourceUrl: game.getResourceUrl(identity.sourceResourceIds[0]),
				...(identity.sourceResourceIds[1] === undefined
					? {}
					: {
							compositeUrl: game.getResourceUrl(identity.sourceResourceIds[1]),
						}),
			};
		},
		[
			game,
			itemId,
		],
	);
	return useRuntimeSelector(game, selector, Equal.equals);
};
