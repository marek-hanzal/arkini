import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

/** Reads one item's current charges, using authored full charges before first use. */
export const readItemRemainingChargesFn = (item: RuntimeItemSchema.Type) =>
	item.remainingCharges ?? item.item.charges?.amount;
