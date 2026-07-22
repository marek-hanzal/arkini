import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { JobQueueRequestSchema } from "~/engine/job/schema/JobQueueRequestSchema";
import type { JobSchema } from "~/engine/job/schema/JobSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace readRuntimeItemOwnedStateFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export interface Result {
		ownerItemIds: ReadonlySet<IdSchema.Type>;
		inputItems: readonly RuntimeItemSchema.Type[];
		jobs: readonly JobSchema.Type[];
		jobItems: readonly RuntimeItemSchema.Type[];
		queue: readonly JobQueueRequestSchema.Type[];
	}
}

/** Reads the complete runtime ownership tree beneath one live item identity. */
export const readRuntimeItemOwnedStateFx = Effect.fn("readRuntimeItemOwnedStateFx")(function* ({
	ownerItemId,
	runtime,
}: readRuntimeItemOwnedStateFx.Props) {
	const ownerItemIds = new Set<IdSchema.Type>([
		ownerItemId,
	]);
	const inputItemIds = new Set<IdSchema.Type>();
	const jobIds = new Set<IdSchema.Type>();
	const jobItemIds = new Set<IdSchema.Type>();

	let changed = true;
	while (changed) {
		changed = false;

		for (const item of runtime.items) {
			if (
				item.location.scope === LocationScopeEnumSchema.enum.Input &&
				ownerItemIds.has(item.location.ownerItemId) &&
				!inputItemIds.has(item.id)
			) {
				inputItemIds.add(item.id);
				ownerItemIds.add(item.id);
				changed = true;
			}
		}

		for (const job of runtime.jobs) {
			if (ownerItemIds.has(job.ownerItemId) && !jobIds.has(job.id)) {
				jobIds.add(job.id);
				changed = true;
			}
		}

		for (const item of runtime.items) {
			if (
				(item.location.scope === LocationScopeEnumSchema.enum.Job || item.location.scope === LocationScopeEnumSchema.enum.Reserved) &&
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
		inputItems: runtime.items.filter((item) => inputItemIds.has(item.id)),
		jobs: runtime.jobs.filter((job) => jobIds.has(job.id)),
		jobItems: runtime.items.filter((item) => jobItemIds.has(item.id)),
		queue: (runtime.jobQueue ?? []).filter((request) => ownerItemIds.has(request.ownerItemId)),
	} satisfies readRuntimeItemOwnedStateFx.Result;
});
