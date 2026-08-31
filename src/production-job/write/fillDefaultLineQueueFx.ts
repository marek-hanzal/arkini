import { Effect, Result } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { enqueueLineRuntimeFx } from "~/production-job/fx/enqueueLineRuntimeFx";
import { readDefaultLineQueueTargetFx } from "~/production-job/fx/read/readDefaultLineQueueTargetFx";
import { resolveLineStartFx } from "~/production-job/fx/read/resolveLineStartFx";
import type { JobQueueRequestSchema } from "~/production-job/schema/JobQueueRequestSchema";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";

export namespace fillDefaultLineQueueFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
	}

	export interface Result {
		readonly added: readonly JobQueueRequestSchema.Type[];
		readonly capacity: number;
		readonly lineId: IdSchema.Type;
		readonly terminalError?: unknown;
		readonly used: number;
	}
}

/**
 * Fills one exact owner's queue through repeated canonical one-intent admission.
 *
 * Every accepted request is accumulated against the evolving candidate runtime. The maximal
 * admitted prefix and all of its events are then published as one runtime transition.
 */
export const fillDefaultLineQueueFx = Effect.fn("fillDefaultLineQueueFx")(function* ({
	ownerItemId,
}: fillDefaultLineQueueFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const line = yield* readDefaultLineQueueTargetFx({
				ownerItemId,
				runtime,
			});
			const initial = yield* resolveLineStartFx({
				lineId: line.id,
				ownerItemId,
				runtime,
			});
			const remainingCapacity = Math.max(0, initial.queue.capacity - initial.queue.used);
			if (remainingCapacity === 0) {
				return [
					{
						added: [],
						capacity: initial.queue.capacity,
						lineId: line.id,
						used: initial.queue.used,
					} satisfies fillDefaultLineQueueFx.Result,
					runtime,
				] as const;
			}

			let candidate = runtime;
			const added: JobQueueRequestSchema.Type[] = [];
			const events: GameEventSchema.Type[] = [];
			for (let index = 0; index < remainingCapacity; index += 1) {
				const attempt = yield* Effect.result(
					enqueueLineRuntimeFx({
						lineId: line.id,
						ownerItemId,
						runtime: candidate,
					}),
				);
				if (Result.isFailure(attempt)) {
					if (added.length === 0) return yield* Effect.fail(attempt.failure);
					return [
						{
							added,
							capacity: initial.queue.capacity,
							lineId: line.id,
							terminalError: attempt.failure,
							used: initial.queue.used + added.length,
						} satisfies fillDefaultLineQueueFx.Result,
						candidate,
						events,
					] as const;
				}
				added.push(attempt.success.request);
				events.push(...attempt.success.events);
				candidate = attempt.success.runtime;
			}

			return [
				{
					added,
					capacity: initial.queue.capacity,
					lineId: line.id,
					used: initial.queue.used + added.length,
				} satisfies fillDefaultLineQueueFx.Result,
				candidate,
				events,
			] as const;
		}),
	);
});
