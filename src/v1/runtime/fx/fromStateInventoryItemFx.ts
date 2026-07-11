import { Effect } from "effect";

import { resolveItemFx } from "~/v1/item/fx/resolveItemFx";
import type { RuntimeInventoryItemSchema } from "~/v1/runtime/schema/RuntimeInventoryItemSchema";
import type { StateInventoryItemSchema } from "~/v1/state/schema/StateInventoryItemSchema";

export namespace fromStateInventoryItemFx {
	export interface Props {
		state: StateInventoryItemSchema.Type;
	}
}

/**
 * Builds one runtime inventory item from its persisted state representation.
 *
 * Counterpart: `fromRuntimeInventoryItemFx` in
 * `~/v1/state/fx/fromRuntimeInventoryItemFx` builds state from this runtime item.
 */
export const fromStateInventoryItemFx = Effect.fn("fromStateInventoryItemFx")(function* ({
	state,
}: fromStateInventoryItemFx.Props) {
	const item = yield* resolveItemFx({
		itemId: state.itemId,
	});
	const result = {
		id: state.id,
		item,
		quantity: state.quantity,
	};

	return result satisfies RuntimeInventoryItemSchema.Type;
});
