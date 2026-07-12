import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { TimestampSchema } from "~/v1/common/schema/TimestampSchema";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
import type { JobResolutionSchema } from "~/v1/job/schema/read/JobResolutionSchema";
import { filterOwnerJobsFx } from "~/v1/job/read/filterOwnerJobsFx";

export namespace resolveOwnerJobQueueFx {
	export interface Props {
		jobs: JobSchema.Type[];
		ownerItemId: IdSchema.Type;
		nowMs: TimestampSchema.Type;
	}
}

/** Resolves one owner's persisted jobs into their current queue execution states. */
export const resolveOwnerJobQueueFx = Effect.fn("resolveOwnerJobQueueFx")(function* ({
	jobs,
	ownerItemId,
	nowMs,
}: resolveOwnerJobQueueFx.Props) {
	const ownerJobs = yield* filterOwnerJobsFx({
		jobs,
		ownerItemId,
	});

	return ownerJobs.map((job, queueIndex) => ({
		job,
		queueIndex,
		previousJobId: ownerJobs[queueIndex - 1]?.id,
		status: nowMs < job.startedAtMs ? "queued" : nowMs < job.dueAtMs ? "running" : "ready",
	})) satisfies JobResolutionSchema.Type[];
});
