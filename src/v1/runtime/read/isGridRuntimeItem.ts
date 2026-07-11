import type { GridRuntimeItemSchema } from "~/v1/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";

/**
 * Narrows one live runtime item to a board or inventory item.
 */
export const isGridRuntimeItem = (
	item: RuntimeItemSchema.Type,
): item is GridRuntimeItemSchema.Type => {
	return item.location.scope === "board" || item.location.scope === "inventory";
};
