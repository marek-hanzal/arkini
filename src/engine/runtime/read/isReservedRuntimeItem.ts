import type { ReservedRuntimeItemSchema } from "~/engine/runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

/** Narrows one runtime item to a live item temporarily retained by a job. */
export const isReservedRuntimeItem = (
	item: RuntimeItemSchema.Type,
): item is ReservedRuntimeItemSchema.Type => item.location.scope === LocationScopeEnumSchema.enum.Reserved;
