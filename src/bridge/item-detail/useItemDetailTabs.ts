import { useCallback } from "react";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import { readItemDetailTabs } from "~/engine/item-detail/read/readItemDetailTabs";
import type { ItemDetailTabEnumSchema } from "~/engine/item-detail/schema/ItemDetailTabEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Reads the authoritative Item Detail tabs supported by one exact live item. */
export namespace useItemDetailTabs {
	export type Tab = ItemDetailTabEnumSchema.Type;
}

export const useItemDetailTabs = (itemId: IdSchema.Type): readonly useItemDetailTabs.Tab[] => {
	const selector = useCallback(
		(runtime: RuntimeSchema.Type) =>
			readItemDetailTabs(runtime.items.find((item) => item.id === itemId)),
		[
			itemId,
		],
	);
	return useRuntimeSelector(selector);
};
