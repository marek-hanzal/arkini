import { Effect } from "effect";
import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
import type { JobResolutionSchema } from "~/v1/job/schema/read/JobResolutionSchema";
import { filterOwnerJobsFx } from "~/v1/job/read/filterOwnerJobsFx";
export namespace resolveOwnerJobQueueFx {
	export interface Props {
		jobs: JobSchema.Type[];
		ownerItemId: IdSchema.Type;
	}
}
export const resolveOwnerJobQueueFx = Effect.fn("resolveOwnerJobQueueFx")(function* ({
	jobs,
	ownerItemId,
}: resolveOwnerJobQueueFx.Props) {
	const ownerJobs = yield* filterOwnerJobsFx({
		jobs,
		ownerItemId,
	});
	return ownerJobs.map((job) => ({
		job,
		status: job.remainingMs === 0 ? "ready" : "running",
	})) satisfies JobResolutionSchema.Type[];
});
