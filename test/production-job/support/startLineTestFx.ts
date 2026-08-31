import { Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { resolveLineStartFx } from "~/production-job/fx/read/resolveLineStartFx";
import { startLineRuntimeFx } from "~/production-job/fx/startLineRuntimeFx";
import { LineRunUnavailableError } from "~/production-line/error/LineRunUnavailableError";
import { modifyRuntimeFx } from "~/game-runtime/internal/modifyRuntimeFx";

export namespace startLineFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
	}
}

/** Test-only direct admission helper for constructing already-running scenarios. */
export const startLineFx = Effect.fn("startLineTestFx")(function* ({
	ownerItemId,
	lineId,
}: startLineFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const hasOwnerWork =
				runtime.jobs.some((job) => job.ownerItemId === ownerItemId) ||
				(runtime.jobQueue ?? []).some((request) => request.ownerItemId === ownerItemId);
			const resolution = yield* resolveLineStartFx({
				ownerItemId,
				lineId,
				runtime,
			});
			if (hasOwnerWork || !resolution.ready) {
				return yield* Effect.fail(
					new LineRunUnavailableError({
						ownerItemId,
						lineId,
					}),
				);
			}
			const [job, nextRuntime, itemEvents] = yield* startLineRuntimeFx({
				ownerItemId,
				lineId,
				runtime,
			});
			return [
				{
					type: "started",
					job,
				},
				nextRuntime,
				[
					{
						type: GameEventEnumSchema.enum.JobStarted,
						jobId: job.id,
						ownerItemId: job.ownerItemId,
						lineId: job.lineId,
					},
					...itemEvents,
				],
			] as const;
		}),
	);
});
