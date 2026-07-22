import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

/**
 * Narrows one live runtime item to a board, inventory, or toolbar item.
 */
export const isGridRuntimeItem = (
	item: RuntimeItemSchema.Type,
): item is GridRuntimeItemSchema.Type => {
	return (
		item.location.scope === LocationScopeEnumSchema.enum.Board ||
		item.location.scope === LocationScopeEnumSchema.enum.Inventory ||
		item.location.scope === LocationScopeEnumSchema.enum.Toolbar
	);
};
