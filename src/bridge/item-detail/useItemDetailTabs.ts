import { useCallback } from "react";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { useItemDetailSources } from "~/bridge/item-detail/useItemDetailSources";
import { readItemDetailTabsFx } from "~/engine/item-detail/read/readItemDetailTabsFx";
import type { ItemDetailTabEnumSchema } from "~/engine/item-detail/schema/ItemDetailTabEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

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

const sameTabs = (
	left: readonly useItemDetailTabs.Tab[],
	right: readonly useItemDetailTabs.Tab[],
) => left.length === right.length && left.every((tab, index) => tab === right[index]);

export const useItemDetailTabs = (
	target: useItemDetailTabs.Target,
	sources: useItemDetailSources.Projection,
): readonly useItemDetailTabs.Tab[] => {
	const game = useGameEngine();
	const { itemId, kind } = target;
	const selector = useCallback(
		(runtime: RuntimeSchema.Type) =>
			game.readOrThrow(
				readItemDetailTabsFx({
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
			),
		[
			game,
			itemId,
			kind,
			sources,
		],
	);
	return useRuntimeSelector(selector, sameTabs);
};
