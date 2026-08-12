import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Planner actions must settle every transient engine owner before the next branch. */
export const isPlannerRuntimeQuiescent = (runtime: RuntimeSchema.Type) =>
	runtime.jobs.length === 0 &&
	(runtime.jobQueue?.length ?? 0) === 0 &&
	runtime.items.every(
		(item) =>
			item.location.scope === "board" ||
			item.location.scope === "inventory" ||
			item.location.scope === "toolbar",
	);
