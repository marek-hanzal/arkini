import { Effect } from "effect";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { assertLineStartReadyFx } from "~/engine/job/fx/assertLineStartReadyFx";
import { createJobQueueRequestFx } from "~/engine/job/fx/createJobQueueRequestFx";
import { resolveLineStartFx } from "~/engine/job/fx/read/resolveLineStartFx";
import { startLineRuntimeFx } from "~/engine/job/fx/startLineRuntimeFx";
import type { StartLineResultSchema } from "~/engine/job/schema/StartLineResultSchema";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
export namespace startLineFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
	}
}
/** Explicitly starts an idle owner or appends one FIFO request behind any existing owner work. */
export const startLineFx = Effect.fn("startLineFx")(function* ({
	ownerItemId,
	lineId,
}: startLineFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const hasOwnerWork =
				runtime.jobs.some((job) => job.ownerItemId === ownerItemId) ||
				(runtime.jobQueue ?? []).some((request) => request.ownerItemId === ownerItemId);
			if (!hasOwnerWork) {
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
					[
						{
							type: "job:started",
							jobId: job.id,
							ownerItemId: job.ownerItemId,
							lineId: job.lineId,
							source: "explicit",
						},
					],
				] as const;
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
