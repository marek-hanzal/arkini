import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

/** Reads one item's current units, using authored full units before first use. */
export const readItemRemainingUnitsFn = (item: RuntimeItemSchema.Type) =>
	item.remainingUnits ?? item.item.units?.amount;
