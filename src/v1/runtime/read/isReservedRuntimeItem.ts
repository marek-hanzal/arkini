import type { ReservedRuntimeItemSchema } from "~/v1/runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";

/** Narrows one runtime item to a live item temporarily retained by a job. */
export const isReservedRuntimeItem = (
	item: RuntimeItemSchema.Type,
): item is ReservedRuntimeItemSchema.Type => item.location.scope === "reserved";
