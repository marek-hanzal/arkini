import { readItemRemainingChargesFn } from "~/production-action/fn/readItemRemainingChargesFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

/** Projects the one count shown by a tile badge from canonical runtime truth. */
export const readTileActorBadgeCountFn = (item: RuntimeItemSchema.Type) => {
	const remainingCharges = readItemRemainingChargesFn(item);
	return remainingCharges ?? (item.quantity > 1 ? item.quantity : undefined);
};
