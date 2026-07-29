import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { applyLineInputAutofillPlanFx } from "~/engine/input/fx/applyLineInputAutofillPlanFx";
import { readLineInputAutofillCoverageFx } from "~/engine/input/fx/readLineInputAutofillCoverageFx";
import { startLineRuntimeFx } from "~/engine/job/fx/startLineRuntimeFx";
import type { JobSchema } from "~/engine/job/schema/JobSchema";
import { JobOwnerBusyError } from "~/engine/job/error/JobOwnerBusyError";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace fillAndStartLineRuntimeFx {
	export interface Props {
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly queueRequestId?: IdSchema.Type;
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
				readonly reason: "missing" | "not-head" | "wrong-line";
				readonly runtime: RuntimeSchema.Type;
		  }
		| {
				readonly type: "started";
				readonly events: readonly GameEventSchema.Type[];
				readonly filledQuantity: number;
				readonly job: JobSchema.Type;
				readonly runtime: RuntimeSchema.Type;
		  };
}

/**
 * Atomically fills exact current inputs and starts through the canonical hard-reservation path.
 *
 * A queue caller supplies the exact FIFO head identity. That request is removed only inside the
 * successful candidate transition; incomplete coverage, stale identity, and typed start failures
 * retain the original runtime unchanged.
 */
export const fillAndStartLineRuntimeFx = Effect.fn("fillAndStartLineRuntimeFx")(function* ({
	lineId,
	ownerItemId,
	queueRequestId,
	runtime,
}: fillAndStartLineRuntimeFx.Props) {
	if (queueRequestId !== undefined) {
		const request = (runtime.jobQueue ?? []).find((candidate) => {
			return candidate.id === queueRequestId;
		});
		if (request === undefined) {
			return {
				type: "queue-request-unavailable",
				reason: "missing",
				runtime,
			} satisfies fillAndStartLineRuntimeFx.Result;
		}
		if (request.ownerItemId !== ownerItemId || request.lineId !== lineId) {
			return {
				type: "queue-request-unavailable",
				reason: "wrong-line",
				runtime,
			} satisfies fillAndStartLineRuntimeFx.Result;
		}
		const ownerHead = (runtime.jobQueue ?? []).find((candidate) => {
			return candidate.ownerItemId === ownerItemId;
		});
		if (ownerHead?.id !== queueRequestId) {
			return {
				type: "queue-request-unavailable",
				reason: "not-head",
				runtime,
			} satisfies fillAndStartLineRuntimeFx.Result;
		}
	}
	const jobIds = runtime.jobs
		.filter((job) => job.ownerItemId === ownerItemId)
		.map((job) => job.id);
	const requestIds = (runtime.jobQueue ?? [])
		.filter((request) => request.ownerItemId === ownerItemId)
		.map((request) => request.id);
	if (jobIds.length > 0 || (queueRequestId === undefined && requestIds.length > 0)) {
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
	if (coverage.type === "incomplete") {
		return {
			type: "incomplete",
			missingQuantity: coverage.missingQuantity,
			runtime,
			selectedQuantity: coverage.selectedQuantity,
		} satisfies fillAndStartLineRuntimeFx.Result;
	}

	const candidate =
		queueRequestId === undefined
			? runtime
			: {
					...runtime,
					jobQueue: (runtime.jobQueue ?? []).filter((request) => {
						return request.id !== queueRequestId;
					}),
				};
	const filled = yield* applyLineInputAutofillPlanFx({
		lineId,
		ownerItemId,
		plan: coverage.plan,
		runtime: candidate,
	});
	const [job, startedRuntime, startEvents] = yield* startLineRuntimeFx({
		lineId,
		ownerItemId,
		runtime: filled.runtime,
	});
	return {
		type: "started",
		events: [
			...filled.events,
			...startEvents,
		],
		filledQuantity: filled.storedQuantity,
		job,
		runtime: startedRuntime,
	} satisfies fillAndStartLineRuntimeFx.Result;
});
