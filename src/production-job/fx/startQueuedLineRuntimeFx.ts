import { Effect } from "effect";

import type { EngineFact } from "~/game-event/type/EngineFact";
import { readLineInputAutofillCoverageFx } from "~/production-input/fx/readLineInputAutofillCoverageFx";
import { startLineRuntimeFx } from "~/production-job/fx/startLineRuntimeFx";
import { assertLineEnqueueConditionsFx } from "~/production-job/fx/assertLineEnqueueConditionsFx";
import { resolveLineStartFx } from "~/production-job/fx/resolveLineStartFx";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import type { JobQueueRequestSchema } from "~/production-job/schema/JobQueueRequestSchema";
import { JobOwnerBusyError } from "~/production-job/error/JobOwnerBusyError";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import { isLineAdmissionOpenFn } from "~/production-line/fn/isLineAdmissionOpenFn";

export namespace startQueuedLineRuntimeFx {
	export interface Props {
		readonly request: JobQueueRequestSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Result =
		| {
				readonly type: "incomplete";
				readonly runtime: RuntimeSchema.Type;
		  }
		| {
				readonly type: "started";
				readonly facts: readonly EngineFact[];
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
	request,
	runtime,
}: startQueuedLineRuntimeFx.Props) {
	const { id: queueRequestId, ownerItemId, lineUid } = request;
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

	const owner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	// Exhausted owners may use settled material, but optional top-ups must not
	// turn that accepted work into a blocked Autofill request.
	if (
		isLineAdmissionOpenFn({
			owner,
			lineUid,
		})
	) {
		const coverage = yield* readLineInputAutofillCoverageFx({
			lineUid,
			ownerItemId,
			runtime,
		});
		if (coverage.type === "incomplete" || coverage.plan.entry.length > 0) {
			// Missing material permits delivery only while the line's other admission
			// conditions still hold. A blocked probe must not lease shared supply.
			const resolution = yield* resolveLineStartFx({
				ownerItemId,
				lineUid,
				runtime,
			});
			yield* assertLineEnqueueConditionsFx({
				resolution,
				runtime,
			});
			return {
				type: "incomplete",
				runtime,
			} satisfies startQueuedLineRuntimeFx.Result;
		}
	}

	const candidate = {
		...runtime,
		jobQueue: runtime.jobQueue.filter((request) => {
			return request.id !== queueRequestId;
		}),
	};
	const [job, startedRuntime, startFacts] = yield* startLineRuntimeFx({
		lineUid,
		ownerItemId,
		runtime: candidate,
	});
	return {
		type: "started",
		facts: startFacts,
		job,
		runtime: startedRuntime,
	} satisfies startQueuedLineRuntimeFx.Result;
});
