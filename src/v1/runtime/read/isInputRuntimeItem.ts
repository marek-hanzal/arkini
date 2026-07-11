import type { InputRuntimeItemSchema } from "~/v1/runtime/schema/InputRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";

/**
 * Narrows one live runtime item to a line-owned input material.
 */
export const isInputRuntimeItem = (
	item: RuntimeItemSchema.Type,
): item is InputRuntimeItemSchema.Type => {
	return item.location.scope === "input";
};
