import type { BoardRuntimeItemSchema } from "~/v1/runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";

/** Narrows one live runtime item to an item occupying board space. */
export const isBoardRuntimeItem = (
	item: RuntimeItemSchema.Type,
): item is BoardRuntimeItemSchema.Type => item.location.scope === "board";
