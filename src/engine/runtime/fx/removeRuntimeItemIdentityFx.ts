import { Effect } from "effect";

import { JobOwnerBusyError } from "~/engine/job/error/JobOwnerBusyError";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace removeRuntimeItemIdentityFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Removes one idle item identity and discards queued work bound to that identity. */
export const removeRuntimeItemIdentityFx = Effect.fn("removeRuntimeItemIdentityFx")(function* ({
	item,
	runtime,
}: removeRuntimeItemIdentityFx.Props) {
	const jobIds = runtime.jobs.filter((job) => job.ownerItemId === item.id).map((job) => job.id);
	if (jobIds.length > 0) {
		return yield* Effect.fail(
			new JobOwnerBusyError({
				ownerItemId: item.id,
				jobIds,
				requestIds: [],
			}),
		);
	}

	return {
		...runtime,
		items: runtime.items.filter((candidate) => candidate.id !== item.id),
		jobQueue: (runtime.jobQueue ?? []).filter((request) => request.ownerItemId !== item.id),
	} satisfies RuntimeSchema.Type;
});
