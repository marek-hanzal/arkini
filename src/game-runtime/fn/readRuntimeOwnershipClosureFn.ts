import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { JobSchema } from "~/production-job/schema/JobSchema";

/** Follows item-owned inputs and jobs, then each job's committed material, from any root set. */
export const readRuntimeOwnershipClosureFn = ({
	rootItemIds,
	items,
	jobs,
}: {
	readonly rootItemIds: ReadonlySet<IdSchema.Type>;
	readonly items: readonly RuntimeItemSchema.Type[];
	readonly jobs: readonly JobSchema.Type[];
}) => {
	const ownerItemIds = new Set(rootItemIds);
	const inputItemIds = new Set<IdSchema.Type>();
	const jobIds = new Set<IdSchema.Type>();
	const jobItemIds = new Set<IdSchema.Type>();

	let changed = true;
	while (changed) {
		changed = false;
		for (const item of items) {
			if (
				item.location.scope === "input" &&
				ownerItemIds.has(item.location.ownerItemId) &&
				!inputItemIds.has(item.id)
			) {
				inputItemIds.add(item.id);
				ownerItemIds.add(item.id);
				changed = true;
			}
		}
		for (const job of jobs) {
			if (ownerItemIds.has(job.ownerItemId) && !jobIds.has(job.id)) {
				jobIds.add(job.id);
				changed = true;
			}
		}
		for (const item of items) {
			if (
				(item.location.scope === "job" || item.location.scope === "reserved") &&
				jobIds.has(item.location.jobId) &&
				!jobItemIds.has(item.id)
			) {
				jobItemIds.add(item.id);
				ownerItemIds.add(item.id);
				changed = true;
			}
		}
	}
	return {
		ownerItemIds,
		inputItemIds,
		jobIds,
		jobItemIds,
	};
};
