import { Effect } from "effect";
import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { assertLineStartReadyFx } from "~/v1/job/fx/assertLineStartReadyFx";
import { createJobQueueRequestFx } from "~/v1/job/fx/createJobQueueRequestFx";
import { resolveLineStartFx } from "~/v1/job/fx/read/resolveLineStartFx";
import { startLineRuntimeFx } from "~/v1/job/fx/startLineRuntimeFx";
import type { StartLineResultSchema } from "~/v1/job/schema/StartLineResultSchema";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
export namespace startLineFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
	}
}
/** Explicitly starts a free owner or appends one FIFO start request behind its active job. */
export const startLineFx = Effect.fn("startLineFx")(function* ({
	ownerItemId,
	lineId,
}: startLineFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const hasActiveJob = runtime.jobs.some((job) => job.ownerItemId === ownerItemId);
			if (!hasActiveJob) {
				const [job, nextRuntime] = yield* startLineRuntimeFx({
					ownerItemId,
					lineId,
					runtime,
				});
				return [
					{
						type: "started",
						job,
					} satisfies StartLineResultSchema.Type,
					nextRuntime,
				] as readonly [
					StartLineResultSchema.Type,
					RuntimeSchema.Type,
				];
			}
			const resolution = yield* resolveLineStartFx({
				ownerItemId,
				lineId,
				runtime,
			});
			yield* assertLineStartReadyFx({
				resolution,
			});
			const request = yield* createJobQueueRequestFx({
				ownerItemId,
				lineId,
			});
			const nextRuntime = {
				...runtime,
				jobQueue: [
					...(runtime.jobQueue ?? []),
					request,
				],
			} satisfies RuntimeSchema.Type;
			return [
				{
					type: "queued",
					request,
				} satisfies StartLineResultSchema.Type,
				nextRuntime,
			] as readonly [
				StartLineResultSchema.Type,
				RuntimeSchema.Type,
			];
		}),
	);
});
