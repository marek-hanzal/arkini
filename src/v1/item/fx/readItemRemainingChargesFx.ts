import { Effect } from "effect";

import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";

/** Reads one item's current charges, using authored full charges before first use. */
export const readItemRemainingChargesFx = Effect.fn("readItemRemainingChargesFx")(function* (
	item: RuntimeItemSchema.Type,
) {
	return item.remainingCharges ?? item.item.charges?.amount;
});
