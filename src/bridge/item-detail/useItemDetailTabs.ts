import { useCallback } from "react";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { useItemDetailSources } from "~/bridge/item-detail/useItemDetailSources";
import { readItemDetailTabs } from "~/engine/item-detail/read/readItemDetailTabs";
import type { ItemDetailTabEnumSchema } from "~/engine/item-detail/schema/ItemDetailTabEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Reads the authoritative Item Detail tabs supported by one exact live item. */
export namespace useItemDetailTabs {
	export type Tab = ItemDetailTabEnumSchema.Type;
}

const sameTabs = (
	left: readonly useItemDetailTabs.Tab[],
	right: readonly useItemDetailTabs.Tab[],
) => left.length === right.length && left.every((tab, index) => tab === right[index]);

export const useItemDetailTabs = (
	itemId: IdSchema.Type,
	sources: useItemDetailSources.Projection,
): readonly useItemDetailTabs.Tab[] => {
	const selector = useCallback(
		(runtime: RuntimeSchema.Type) =>
			readItemDetailTabs(
				runtime.items.find((item) => item.id === itemId),
				sources,
			),
		[
			itemId,
			sources,
		],
	);
	return useRuntimeSelector(selector, sameTabs);
};
