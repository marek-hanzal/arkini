import { readItemRemainingUnitsFn } from "~/production-action/fn/readItemRemainingUnitsFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

/** Projects the one count shown by a tile badge from canonical runtime truth. */
export const readTileActorBadgeCountFn = (item: RuntimeItemSchema.Type) => {
	const remainingUnits = readItemRemainingUnitsFn(item);
	return remainingUnits ?? (item.quantity > 1 ? item.quantity : undefined);
};
