import { Effect } from "effect";

import type { RuntimeInventoryItemSchema } from "~/v1/runtime/schema/RuntimeInventoryItemSchema";
import type { StateInventoryItemSchema } from "~/v1/state/schema/StateInventoryItemSchema";

export namespace dehydrateRuntimeInventoryItemFx {
	export interface Props {
		item: RuntimeInventoryItemSchema.Type;
	}
}

/**
 * Replaces one runtime inventory item's canonical object with its stable item ID.
 */
export const dehydrateRuntimeInventoryItemFx = Effect.fn("dehydrateRuntimeInventoryItemFx")(
	function* ({ item }: dehydrateRuntimeInventoryItemFx.Props) {
		const result = {
			id: item.id,
			itemId: item.item.id,
			quantity: item.quantity,
		};

		return result satisfies StateInventoryItemSchema.Type;
	},
);
