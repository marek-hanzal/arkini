import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { JobQueueFullError } from "~/engine/job/error/JobQueueFullError";
import { assertLineEnqueueConditionsFx } from "~/engine/job/fx/assertLineEnqueueConditionsFx";
import { createJobQueueRequestFx } from "~/engine/job/fx/createJobQueueRequestFx";
import { resolveLineStartFx } from "~/engine/job/fx/read/resolveLineStartFx";
import type { JobQueueRequestSchema } from "~/engine/job/schema/JobQueueRequestSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { isolateStatefulOwnerTransitionFx } from "~/engine/item/fx/isolateStatefulOwnerTransitionFx";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";

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
	const request = yield* createJobQueueRequestFx({
		ownerItemId,
		lineId,
	});
	const isolation = yield* isolateStatefulOwnerTransitionFx({
		ownerItemId,
		runtime: {
			...runtime,
			jobQueue: [
				...(runtime.jobQueue ?? []),
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
