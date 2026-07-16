import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { JobOwnerBusyError } from "~/engine/job/error/JobOwnerBusyError";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace assertOwnerIdleFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Rejects removal while one runtime item still owns active or queued work. */
export const assertOwnerIdleFx = Effect.fn("assertOwnerIdleFx")(function* ({
	ownerItemId,
	runtime,
}: assertOwnerIdleFx.Props) {
	const jobIds = runtime.jobs
		.filter((job) => job.ownerItemId === ownerItemId)
		.map((job) => job.id);
	const requestIds = (runtime.jobQueue ?? [])
		.filter((request) => request.ownerItemId === ownerItemId)
		.map((request) => request.id);

	if (jobIds.length === 0 && requestIds.length === 0) {
		return;
	}

	return yield* Effect.fail(
		new JobOwnerBusyError({
			ownerItemId,
			jobIds,
			requestIds,
		}),
	);
});
