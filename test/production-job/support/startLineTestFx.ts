import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { resolveLineStartFx } from "~/production-job/fx/resolveLineStartFx";
import { startLineRuntimeFx } from "~/production-job/fx/startLineRuntimeFx";
import { LineRunUnavailableError } from "~/production-line/error/LineRunUnavailableError";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";

export namespace startLineFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineUid: IdSchema.Type;
	}
}

/** Test-only direct admission helper for constructing already-running scenarios. */
export const startLineFx = Effect.fn("startLineTestFx")(function* ({
	ownerItemId,
	lineUid,
}: startLineFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const hasOwnerWork =
				runtime.jobs.some((job) => job.ownerItemId === ownerItemId) ||
				(runtime.jobQueue ?? []).some((request) => request.ownerItemId === ownerItemId);
			const resolution = yield* resolveLineStartFx({
				ownerItemId,
				lineUid,
				runtime,
			});
			if (hasOwnerWork || !resolution.ready) {
				return yield* Effect.fail(
					new LineRunUnavailableError({
						ownerItemId,
						lineUid,
					}),
				);
			}
			const owner = yield* readRuntimeItemByIdFx({
				itemId: ownerItemId,
				runtime,
			});
			const [job, nextRuntime, itemEvents] = yield* startLineRuntimeFx({
				ownerItemId,
				lineUid,
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
						itemUid: owner.item.uid,
						jobId: job.id,
						ownerItemId: job.ownerItemId,
						lineUid: job.lineUid,
					},
					...itemEvents,
				],
			] as const;
		}),
	);
});
