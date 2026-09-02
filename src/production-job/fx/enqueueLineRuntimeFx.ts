import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { JobQueueFullError } from "~/production-job/error/JobQueueFullError";
import { assertLineEnqueueConditionsFx } from "~/production-job/fx/assertLineEnqueueConditionsFx";
import { createJobIdFx } from "~/production-job/fx/createJobIdFx";
import { resolveLineStartFx } from "~/production-job/fx/resolveLineStartFx";
import type { JobQueueRequestSchema } from "~/production-job/schema/JobQueueRequestSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { isolateBoardStatefulOwnerTransitionFx } from "~/item-state-isolation/fx/isolateBoardStatefulOwnerTransitionFx";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";

export namespace enqueueLineRuntimeFx {
	export interface Props {
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly request: JobQueueRequestSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Appends one explicit line intent without starting, filling, or reserving inputs.
 *
 * Missing concrete material is queueable. Owner, line, rules, non-material inputs, output limits,
 * and queue capacity remain authoritative hard admission boundaries.
 */
export const enqueueLineRuntimeFx = Effect.fn("enqueueLineRuntimeFx")(function* ({
	lineId,
	ownerItemId,
	runtime,
}: enqueueLineRuntimeFx.Props) {
	const resolution = yield* resolveLineStartFx({
		ownerItemId,
		lineId,
		runtime,
	});
	if (!resolution.queue.available) {
		return yield* Effect.fail(
			new JobQueueFullError({
				ownerItemId,
				maxQueueSize: resolution.queue.capacity,
				queueSize: resolution.queue.used as PositiveIntegerSchema.Type,
			}),
		);
	}

	yield* assertLineEnqueueConditionsFx({
		candidateId: `queue-admission:${ownerItemId}:${lineId}`,
		resolution,
		runtime,
	});
	const request = {
		id: yield* createJobIdFx(),
		ownerItemId,
		lineId,
	} satisfies JobQueueRequestSchema.Type;
	const isolation = yield* isolateBoardStatefulOwnerTransitionFx({
		ownerItemId,
		runtime: {
			...runtime,
			jobQueue: [
				...runtime.jobQueue,
				request,
			],
		},
	});
	return {
		events: isolation.events,
		request,
		runtime: isolation.runtime,
	} satisfies enqueueLineRuntimeFx.Result;
});
