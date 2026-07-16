import { Effect } from "effect";
import type { JobQueueResolutionSchema } from "~/engine/job/schema/read/JobQueueResolutionSchema";
import { filterOwnerJobsFx } from "~/engine/job/read/filterOwnerJobsFx";
import { readItemQueueSizeFx } from "~/engine/job/read/readItemQueueSizeFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
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
	const capacity = yield* readItemQueueSizeFx({
		item: owner.item,
	});
	if (capacity === undefined)
		return yield* Effect.dieMessage(
			`Runtime item ${owner.id} owns a line but does not define job queue capacity.`,
		);
	const jobs = yield* filterOwnerJobsFx({
		jobs: runtime.jobs,
		ownerItemId: owner.id,
	});
	const requests = (runtime.jobQueue ?? []).filter((request) => request.ownerItemId === owner.id);
	const used = jobs.length + requests.length;
	return {
		jobs,
		requests,
		used,
		capacity,
		available: used < capacity,
	} satisfies JobQueueResolutionSchema.Type;
});
