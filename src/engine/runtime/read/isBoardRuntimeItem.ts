import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

/** Narrows one live runtime item to an item occupying board space. */
export const isBoardRuntimeItem = (
	item: RuntimeItemSchema.Type,
): item is BoardRuntimeItemSchema.Type =>
	item.location.scope === LocationScopeEnumSchema.enum.Board;
