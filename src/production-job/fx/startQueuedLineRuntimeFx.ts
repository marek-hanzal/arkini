import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { readLineInputAutofillCoverageFx } from "~/production-input/fx/readLineInputAutofillCoverageFx";
import { startLineRuntimeFx } from "~/production-job/fx/startLineRuntimeFx";
import { assertLineEnqueueConditionsFx } from "~/production-job/fx/assertLineEnqueueConditionsFx";
import { resolveLineStartFx } from "~/production-job/fx/resolveLineStartFx";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import { JobOwnerBusyError } from "~/production-job/error/JobOwnerBusyError";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace startQueuedLineRuntimeFx {
	export interface Props {
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly queueRequestId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Result =
		| {
				readonly type: "incomplete";
				readonly missingQuantity: number;
				readonly runtime: RuntimeSchema.Type;
				readonly selectedQuantity: number;
		  }
		| {
				readonly type: "queue-request-unavailable";
				readonly reason: "missing" | "wrong-line";
				readonly runtime: RuntimeSchema.Type;
		  }
		| {
				readonly type: "started";
				readonly events: readonly GameEventSchema.Type[];
				readonly job: JobSchema.Type;
				readonly runtime: RuntimeSchema.Type;
		  };
}

/**
 * Starts only from canonical input truth after every physical delivery has settled.
 *
 * Tick probes requests in intent order and supplies each exact identity. The request is removed
 * only inside the successful start transition. Grid autofill coverage is reported to the caller
 * but never applied here; material travels through Delivery before becoming startable.
 */
export const startQueuedLineRuntimeFx = Effect.fn("startQueuedLineRuntimeFx")(function* ({
	lineId,
	ownerItemId,
	queueRequestId,
	runtime,
}: startQueuedLineRuntimeFx.Props) {
	const request = runtime.jobQueue.find((candidate) => {
		return candidate.id === queueRequestId;
	});
	if (request === undefined) {
		return {
			type: "queue-request-unavailable",
			reason: "missing",
			runtime,
		} satisfies startQueuedLineRuntimeFx.Result;
	}
	if (request.ownerItemId !== ownerItemId || request.lineId !== lineId) {
		return {
			type: "queue-request-unavailable",
			reason: "wrong-line",
			runtime,
		} satisfies startQueuedLineRuntimeFx.Result;
	}
	const jobIds = runtime.jobs
		.filter((job) => job.ownerItemId === ownerItemId)
		.map((job) => job.id);
	const requestIds = runtime.jobQueue
		.filter((request) => request.ownerItemId === ownerItemId)
		.map((request) => request.id);
	if (jobIds.length > 0) {
		return yield* Effect.fail(
			new JobOwnerBusyError({
				ownerItemId,
				jobIds,
				requestIds,
			}),
		);
	}

	const coverage = yield* readLineInputAutofillCoverageFx({
		lineId,
		ownerItemId,
		runtime,
	});
	if (coverage.type === "incomplete" || coverage.plan.entry.length > 0) {
		// Missing material permits delivery only while the line's other admission
		// conditions still hold. A blocked probe must not lease shared supply.
		const resolution = yield* resolveLineStartFx({
			ownerItemId,
			lineId,
			runtime,
		});
		yield* assertLineEnqueueConditionsFx({
			candidateId: queueRequestId,
			resolution,
			runtime,
		});
		return {
			type: "incomplete",
			missingQuantity: coverage.type === "incomplete" ? coverage.missingQuantity : 0,
			runtime,
			selectedQuantity: coverage.selectedQuantity,
		} satisfies startQueuedLineRuntimeFx.Result;
	}

	const candidate = {
		...runtime,
		jobQueue: runtime.jobQueue.filter((request) => {
			return request.id !== queueRequestId;
		}),
	};
	const [job, startedRuntime, startEvents] = yield* startLineRuntimeFx({
		lineId,
		ownerItemId,
		runtime: candidate,
	});
	return {
		type: "started",
		events: startEvents,
		job,
		runtime: startedRuntime,
	} satisfies startQueuedLineRuntimeFx.Result;
});
