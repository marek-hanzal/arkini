import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

/**
 * Narrows one live runtime item to a board, inventory, or toolbar item.
 */
export const isGridRuntimeItem = (
	item: RuntimeItemSchema.Type,
): item is GridRuntimeItemSchema.Type => {
	return (
		item.location.scope === "board" ||
		item.location.scope === "inventory" ||
		item.location.scope === "toolbar"
	);
};
