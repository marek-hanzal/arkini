import { Equal } from "effect";
import { useCallback } from "react";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

import { useGameEngine } from "~/ui/game/useGameEngine";
import { useRuntimeSelector } from "~/ui/game/useRuntimeSelector";
import type { useItemDetailSources } from "~/ui/item-detail/useItemDetailSources";
import { readItemDetailTabsFn } from "~/engine/item-detail/fn/readItemDetailTabsFn";
import type { ItemDetailTabEnumSchema } from "~/engine/item-detail/schema/ItemDetailTabEnumSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** Reads the authoritative Item Detail tabs supported by one exact live item. */
export namespace useItemDetailTabs {
	export type Tab = ItemDetailTabEnumSchema.Type;
	export type Target =
		| {
				readonly kind: "runtime";
				readonly itemId: IdSchema.Type;
		  }
		| {
				readonly kind: "definition";
				readonly itemId: IdSchema.Type;
		  };
}

export const useItemDetailTabs = (
	target: useItemDetailTabs.Target,
	sources: useItemDetailSources.Projection,
): readonly useItemDetailTabs.Tab[] => {
	const game = useGameEngine();
	const { itemId, kind } = target;
	const selector = useCallback(
		(runtime: RuntimeSchema.Type) =>
			readItemDetailTabsFn({
				target:
					kind === "runtime"
						? {
								kind,
								item: runtime.items.find((item) => item.id === itemId),
							}
						: {
								kind,
							},
				sources,
			}),
		[
			game,
			itemId,
			kind,
			sources,
		],
	);
	return useRuntimeSelector(game, selector, Equal.equals);
};
