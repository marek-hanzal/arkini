import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { JobQueueFullError } from "~/v1/job/error/JobQueueFullError";
import type { LineStartResolutionSchema } from "~/v1/job/schema/read/LineStartResolutionSchema";
import { LineRunUnavailableError } from "~/v1/line/error/LineRunUnavailableError";
import type { LineRunPlanSchema } from "~/v1/line/schema/run/LineRunPlanSchema";

export namespace assertLineStartReadyFx {
	export interface Props {
		resolution: LineStartResolutionSchema.Type;
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

	return plan satisfies LineRunPlanSchema.Type;
});
