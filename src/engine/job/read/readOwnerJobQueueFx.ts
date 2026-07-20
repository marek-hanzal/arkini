import { Effect } from "effect";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { resolveJobRunnableFx } from "~/engine/job/fx/resolveJobRunnableFx";
import type { JobResolutionSchema } from "~/engine/job/schema/read/JobResolutionSchema";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import { isPassiveStorageLocation } from "~/engine/location/read/isPassiveStorageLocation";
export namespace readOwnerJobQueueFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
	}
}
/** Reads active jobs and derives running, paused, or ready from remaining time and live rules. */
export const readOwnerJobQueueFx = Effect.fn("readOwnerJobQueueFx")(function* ({
	ownerItemId,
}: readOwnerJobQueueFx.Props) {
	const runtime = yield* readRuntimeFx();
	const jobs = runtime.jobs.filter((job) => job.ownerItemId === ownerItemId);
	const owner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	return yield* Effect.forEach(jobs, (job) =>
		Effect.gen(function* () {
			if (isPassiveStorageLocation(owner.location))
				return {
					job,
					status: "paused",
				} satisfies JobResolutionSchema.Type;
			if (job.remainingMs === 0)
				return {
					job,
					status: "ready",
				} satisfies JobResolutionSchema.Type;
			const runnable = yield* resolveJobRunnableFx({
				job,
				runtime,
			});
			return {
				job,
				status: runnable ? "running" : "paused",
			} satisfies JobResolutionSchema.Type;
		}),
	);
});
