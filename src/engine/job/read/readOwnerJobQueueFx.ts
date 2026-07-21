import { Effect } from "effect";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { resolveActiveJobStatusFx } from "~/engine/job/fx/resolveActiveJobStatusFx";
import type { JobResolutionSchema } from "~/engine/job/schema/read/JobResolutionSchema";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
export namespace readOwnerJobQueueFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
	}
}
/** Reads active jobs through the canonical active-job classifier. */
export const readOwnerJobQueueFx = Effect.fn("readOwnerJobQueueFx")(function* ({
	ownerItemId,
}: readOwnerJobQueueFx.Props) {
	const runtime = yield* readRuntimeFx();
	const jobs = runtime.jobs.filter((job) => job.ownerItemId === ownerItemId);
	yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	return yield* Effect.forEach(jobs, (job) =>
		resolveActiveJobStatusFx({
			job,
			runtime,
		}).pipe(
			Effect.map(
				(status) =>
					({
						job,
						status,
					}) satisfies JobResolutionSchema.Type,
			),
		),
	);
});
