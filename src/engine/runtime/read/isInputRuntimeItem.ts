import type { InputRuntimeItemSchema } from "~/engine/runtime/schema/InputRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

/**
 * Narrows one live runtime item to a line-owned input material.
 */
export const isInputRuntimeItem = (
	item: RuntimeItemSchema.Type,
): item is InputRuntimeItemSchema.Type => {
	return item.location.scope === LocationScopeEnumSchema.enum.Input;
};
