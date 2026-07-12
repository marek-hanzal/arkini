import { Effect } from "effect";
import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { resolveJobRunnableFx } from "~/v1/job/fx/resolveJobRunnableFx";
import type { JobResolutionSchema } from "~/v1/job/schema/read/JobResolutionSchema";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { readRuntimeItemByIdFx } from "~/v1/runtime/read/readRuntimeItemByIdFx";
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
			if (owner.location.scope === "inventory")
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
