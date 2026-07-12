import type { JobRuntimeItemSchema } from "~/v1/runtime/schema/JobRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";

/** Whether one live runtime item is currently reserved by an active job. */
export const isJobRuntimeItem = (
	item: RuntimeItemSchema.Type,
): item is JobRuntimeItemSchema.Type => {
	return item.location.scope === "job";
};
