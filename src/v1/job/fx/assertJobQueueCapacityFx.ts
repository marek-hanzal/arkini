import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { JobQueueFullError } from "~/v1/job/error/JobQueueFullError";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import { filterOwnerJobsFx } from "~/v1/job/read/filterOwnerJobsFx";
import { readItemQueueSizeFx } from "~/v1/job/read/readItemQueueSizeFx";
import type { JobSchema } from "~/v1/job/schema/JobSchema";

export namespace assertJobQueueCapacityFx {
	export interface Props {
		jobs: JobSchema.Type[];
		owner: RuntimeItemSchema.Type;
	}
}

/** Fails when one line owner has no remaining active-job queue capacity. */
export const assertJobQueueCapacityFx = Effect.fn("assertJobQueueCapacityFx")(function* ({
	jobs,
	owner,
}: assertJobQueueCapacityFx.Props) {
	const maxQueueSize = yield* readItemQueueSizeFx({
		item: owner.item,
	});
	if (maxQueueSize === undefined) {
		return undefined;
	}

	const ownerJobs = yield* filterOwnerJobsFx({
		jobs,
		ownerItemId: owner.id,
	});
	if (ownerJobs.length >= maxQueueSize) {
		return yield* Effect.fail(
			new JobQueueFullError({
				ownerItemId: owner.id,
				maxQueueSize,
				queueSize: ownerJobs.length as PositiveIntegerSchema.Type,
			}),
		);
	}

	return maxQueueSize;
});
