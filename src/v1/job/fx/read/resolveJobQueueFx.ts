import { Effect } from "effect";

import type { JobQueueResolutionSchema } from "~/v1/job/schema/read/JobQueueResolutionSchema";
import { filterOwnerJobsFx } from "~/v1/job/read/filterOwnerJobsFx";
import { readItemQueueSizeFx } from "~/v1/job/read/readItemQueueSizeFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { JobSchema } from "~/v1/job/schema/JobSchema";

export namespace resolveJobQueueFx {
	export interface Props {
		jobs: JobSchema.Type[];
		owner: RuntimeItemSchema.Type;
	}
}

/** Resolves one line owner's current active-job queue without mutating runtime. */
export const resolveJobQueueFx = Effect.fn("resolveJobQueueFx")(function* ({
	jobs,
	owner,
}: resolveJobQueueFx.Props) {
	const capacity = yield* readItemQueueSizeFx({
		item: owner.item,
	});
	if (capacity === undefined) {
		return yield* Effect.dieMessage(
			`Runtime item ${owner.id} owns a line but does not define job queue capacity.`,
		);
	}

	const ownerJobs = yield* filterOwnerJobsFx({
		jobs,
		ownerItemId: owner.id,
	});
	const used = ownerJobs.length;

	return {
		jobs: ownerJobs,
		used,
		capacity,
		available: used < capacity,
	} satisfies JobQueueResolutionSchema.Type;
});
