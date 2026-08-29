import { Effect } from "effect";
import type { JobQueueResolutionSchema } from "~/production-job/schema/read/JobQueueResolutionSchema";
import { readItemQueueSizeFn } from "~/production-job/fn/readItemQueueSizeFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
export namespace resolveJobQueueFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
		owner: RuntimeItemSchema.Type;
	}
}
export const resolveJobQueueFx = Effect.fn("resolveJobQueueFx")(function* ({
	runtime,
	owner,
}: resolveJobQueueFx.Props) {
	const capacity = readItemQueueSizeFn({
		item: owner.item,
	});
	if (capacity === undefined)
		return yield* Effect.die(
			new Error(
				`Runtime item ${owner.id} owns a line but does not define job queue capacity.`,
			),
		);
	const jobs = runtime.jobs.filter((job) => job.ownerItemId === owner.id);
	const requests = runtime.jobQueue.filter((request) => request.ownerItemId === owner.id);
	const used = jobs.length + requests.length;
	return {
		jobs,
		requests,
		used,
		capacity,
		available: used < capacity,
	} satisfies JobQueueResolutionSchema.Type;
});
