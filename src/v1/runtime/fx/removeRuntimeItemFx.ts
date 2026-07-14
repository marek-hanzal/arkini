import { Effect } from "effect";

import { releaseOwnerInputsFx } from "~/v1/input/fx/releaseOwnerInputsFx";
import { JobOwnerBusyError } from "~/v1/job/error/JobOwnerBusyError";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace removeRuntimeItemFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Removes one item, releases its buffered inputs, and discards its queued identity-bound work. */
export const removeRuntimeItemFx = Effect.fn("removeRuntimeItemFx")(function* ({
	item,
	runtime,
}: removeRuntimeItemFx.Props) {
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

	const releasedRuntime = yield* releaseOwnerInputsFx({
		owner: item,
		runtime,
	});

	return {
		...releasedRuntime,
		items: releasedRuntime.items.filter((candidate) => candidate.id !== item.id),
		jobQueue: (releasedRuntime.jobQueue ?? []).filter(
			(request) => request.ownerItemId !== item.id,
		),
	} satisfies RuntimeSchema.Type;
});
