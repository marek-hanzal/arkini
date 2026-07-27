import { Effect } from "effect";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { assertLineStartReadyFx } from "~/engine/job/fx/assertLineStartReadyFx";
import { assertLineOutputMaxCountFx } from "~/engine/job/fx/assertLineOutputMaxCountFx";
import { createJobQueueRequestFx } from "~/engine/job/fx/createJobQueueRequestFx";
import { resolveLineStartFx } from "~/engine/job/fx/read/resolveLineStartFx";
import { startLineRuntimeFx } from "~/engine/job/fx/startLineRuntimeFx";
import type { StartLineResultSchema } from "~/engine/job/schema/StartLineResultSchema";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { JobStartSourceEnumSchema } from "~/engine/event/schema/JobStartSourceEnumSchema";
import { StartLineResultEnumSchema } from "~/engine/job/schema/StartLineResultEnumSchema";
export namespace startLineFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
	}
}
/**
 * Explicitly starts an idle owner or appends one FIFO request behind existing owner work.
 *
 * The command commits only its own admission. Even under Instant gameplay, completion belongs to
 * the shared Tick boundary so independent owner commands can enter the runtime before one global
 * simulation pass resolves every runnable job.
 */
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
				const [job, nextRuntime, itemEvents] = yield* startLineRuntimeFx({
					ownerItemId,
					lineId,
					runtime,
				});
				return [
					{
						type: StartLineResultEnumSchema.enum.Started,
						job,
					} satisfies StartLineResultSchema.Type,
					nextRuntime,
					[
						{
							type: GameEventEnumSchema.enum.JobStarted,
							jobId: job.id,
							ownerItemId: job.ownerItemId,
							lineId: job.lineId,
							source: JobStartSourceEnumSchema.enum.Explicit,
						},
						...itemEvents,
					],
				] as const;
			}
			const resolution = yield* resolveLineStartFx({
				ownerItemId,
				lineId,
				runtime,
			});
			const plan = yield* assertLineStartReadyFx({
				resolution,
			});
			yield* assertLineOutputMaxCountFx({
				candidateId: `queue-admission:${ownerItemId}:${lineId}`,
				ownerItemId,
				lineId,
				plan,
				runtime,
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
					type: StartLineResultEnumSchema.enum.Queued,
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
