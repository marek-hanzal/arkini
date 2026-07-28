import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import type { JobStartSourceEnumSchema } from "~/engine/event/schema/JobStartSourceEnumSchema";
import { assertLineOutputMaxCountFx } from "~/engine/job/fx/assertLineOutputMaxCountFx";
import { assertLineStartReadyFx } from "~/engine/job/fx/assertLineStartReadyFx";
import { createJobQueueRequestFx } from "~/engine/job/fx/createJobQueueRequestFx";
import { resolveLineStartFx } from "~/engine/job/fx/read/resolveLineStartFx";
import { startLineRuntimeFx } from "~/engine/job/fx/startLineRuntimeFx";
import { StartLineResultEnumSchema } from "~/engine/job/schema/StartLineResultEnumSchema";
import type { StartLineResultSchema } from "~/engine/job/schema/StartLineResultSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace requestLineStartRuntimeFx {
	export interface Props {
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
		readonly source: JobStartSourceEnumSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
		readonly start: StartLineResultSchema.Type;
	}
}

/** Applies one explicit or delivery-owned line-start request to an immutable runtime draft. */
export const requestLineStartRuntimeFx = Effect.fn("requestLineStartRuntimeFx")(function* ({
	lineId,
	ownerItemId,
	runtime,
	source,
}: requestLineStartRuntimeFx.Props) {
	const hasOwnerWork =
		runtime.jobs.some((job) => job.ownerItemId === ownerItemId) ||
		(runtime.jobQueue ?? []).some((request) => request.ownerItemId === ownerItemId);
	if (!hasOwnerWork) {
		const [job, nextRuntime, itemEvents] = yield* startLineRuntimeFx({
			ownerItemId,
			lineId,
			runtime,
		});
		return {
			events: [
				{
					type: GameEventEnumSchema.enum.JobStarted,
					jobId: job.id,
					ownerItemId: job.ownerItemId,
					lineId: job.lineId,
					source,
				},
				...itemEvents,
			],
			runtime: nextRuntime,
			start: {
				type: StartLineResultEnumSchema.enum.Started,
				job,
			},
		} satisfies requestLineStartRuntimeFx.Result;
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
	return {
		events: [],
		runtime: {
			...runtime,
			jobQueue: [
				...(runtime.jobQueue ?? []),
				request,
			],
		},
		start: {
			type: StartLineResultEnumSchema.enum.Queued,
			request,
		},
	} satisfies requestLineStartRuntimeFx.Result;
});
