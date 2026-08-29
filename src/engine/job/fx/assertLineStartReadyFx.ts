import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { JobQueueFullError } from "~/engine/job/error/JobQueueFullError";
import type { resolveLineStartFx } from "~/engine/job/fx/read/resolveLineStartFx";
import { LineRunUnavailableError } from "~/engine/line/error/LineRunUnavailableError";
import type { LineRun } from "~/engine/line/LineRun";

export namespace assertLineStartReadyFx {
	export interface Props {
		resolution: resolveLineStartFx.Result;
	}
}

/** Returns the current run plan or fails with the explicit reason this line cannot start. */
export const assertLineStartReadyFx = Effect.fn("assertLineStartReadyFx")(function* ({
	resolution,
}: assertLineStartReadyFx.Props) {
	const plan = resolution.run.plan;
	if (plan === undefined) {
		return yield* Effect.fail(
			new LineRunUnavailableError({
				ownerItemId: resolution.ownerItemId,
				lineId: resolution.lineId,
			}),
		);
	}
	if (!resolution.queue.available) {
		return yield* Effect.fail(
			new JobQueueFullError({
				ownerItemId: resolution.ownerItemId,
				maxQueueSize: resolution.queue.capacity,
				queueSize: resolution.queue.used as PositiveIntegerSchema.Type,
			}),
		);
	}
	if (!resolution.ready) {
		return yield* Effect.fail(
			new LineRunUnavailableError({
				ownerItemId: resolution.ownerItemId,
				lineId: resolution.lineId,
			}),
		);
	}

	return plan satisfies LineRun.Plan;
});
