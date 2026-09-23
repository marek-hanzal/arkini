import { Effect } from "effect";
import { isItemProductionAdmissionOpenFn } from "~/production-line/fn/isItemProductionAdmissionOpenFn";
import { LineRunUnavailableError } from "~/production-line/error/LineRunUnavailableError";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { JobQueueFullError } from "~/production-job/error/JobQueueFullError";
import { assertLineEnqueueConditionsFx } from "~/production-job/fx/assertLineEnqueueConditionsFx";
import { createJobIdFx } from "~/production-job/fx/createJobIdFx";
import { resolveLineStartFx } from "~/production-job/fx/resolveLineStartFx";
import type { JobQueueRequestSchema } from "~/production-job/schema/JobQueueRequestSchema";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";

export namespace enqueueLineRuntimeFx {
	export interface Props {
		readonly lineUid: IdSchema.Type;
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
 * Missing concrete material is queueable. Owner, line, rules, non-material inputs, outcome limits,
 * and queue capacity remain authoritative hard admission boundaries.
 */
export const enqueueLineRuntimeFx = Effect.fn("enqueueLineRuntimeFx")(function* ({
	lineUid,
	ownerItemId,
	runtime,
}: enqueueLineRuntimeFx.Props) {
	const owner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	if (!isItemProductionAdmissionOpenFn(owner))
		return yield* Effect.fail(
			new LineRunUnavailableError({
				ownerItemId,
				lineUid,
			}),
		);
	const resolution = yield* resolveLineStartFx({
		ownerItemId,
		lineUid,
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
		resolution,
		runtime,
	});
	const request = {
		id: yield* createJobIdFx(),
		ownerItemId,
		lineUid,
	} satisfies JobQueueRequestSchema.Type;

	return {
		events: [
			{
				type: "job:queued",
				requestId: request.id,
				ownerItemId,
				itemUid: owner.item.uid,
				lineUid,
			},
		],
		request,
		runtime: {
			...runtime,
			jobQueue: [
				...runtime.jobQueue,
				request,
			],
		},
	} satisfies enqueueLineRuntimeFx.Result;
});
