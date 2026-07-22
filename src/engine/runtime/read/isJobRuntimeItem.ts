import type { JobRuntimeItemSchema } from "~/engine/runtime/schema/JobRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

/** Whether one live runtime item is currently committed to an active job. */
export const isJobRuntimeItem = (
	item: RuntimeItemSchema.Type,
): item is JobRuntimeItemSchema.Type => {
	return item.location.scope === LocationScopeEnumSchema.enum.Job;
};
