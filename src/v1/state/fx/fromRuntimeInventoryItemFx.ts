import { Effect } from "effect";

import type { RuntimeInventoryItemSchema } from "~/v1/runtime/schema/RuntimeInventoryItemSchema";
import type { StateInventoryItemSchema } from "~/v1/state/schema/StateInventoryItemSchema";

export namespace fromRuntimeInventoryItemFx {
	export interface Props {
		item: RuntimeInventoryItemSchema.Type;
	}
}

/**
 * Builds one persisted inventory item from its runtime representation.
 *
 * Counterpart: `fromStateInventoryItemFx` in
 * `~/v1/runtime/fx/fromStateInventoryItemFx` builds runtime from this state item.
 */
export const fromRuntimeInventoryItemFx = Effect.fn("fromRuntimeInventoryItemFx")(function* ({
	item,
}: fromRuntimeInventoryItemFx.Props) {
	const result = {
		id: item.id,
		itemId: item.item.id,
		quantity: item.quantity,
	};

	return result satisfies StateInventoryItemSchema.Type;
});
