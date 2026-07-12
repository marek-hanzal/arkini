import { Clock, Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { assertJobQueueCapacityFx } from "~/v1/job/fx/assertJobQueueCapacityFx";
import { createJobFx } from "~/v1/job/fx/createJobFx";
import type { StartLineResultSchema } from "~/v1/job/schema/StartLineResultSchema";
import { LineRunUnavailableError } from "~/v1/line/error/LineRunUnavailableError";
import { applyLineRunPlanFx } from "~/v1/line/fx/run/applyLineRunPlanFx";
import { resolveLineRunFx } from "~/v1/line/fx/run/resolveLineRunFx";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import { readRuntimeItemByIdFx } from "~/v1/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace startLineFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
	}
}

/**
 * Atomically resolves one current line run, applies its inputs, and creates its job.
 */
export const startLineFx = Effect.fn("startLineFx")(function* ({
	ownerItemId,
	lineId,
}: startLineFx.Props) {
	return yield* modifyRuntimeFx((runtime) => {
		return Effect.gen(function* () {
			const resolution = yield* resolveLineRunFx({
				ownerItemId,
				lineId,
				runtime,
			});
			if (resolution.plan === undefined) {
				return yield* Effect.fail(
					new LineRunUnavailableError({
						ownerItemId,
						lineId,
					}),
				);
			}

			const owner = yield* readRuntimeItemByIdFx({
				itemId: ownerItemId,
				runtime,
			});
			yield* assertJobQueueCapacityFx({
				jobs: runtime.jobs,
				owner,
			});

			const startedAtMs = yield* Clock.currentTimeMillis;
			const job = yield* createJobFx({
				ownerItemId,
				lineId,
				startedAtMs,
				dueAtMs: startedAtMs + resolution.plan.runtimeMs,
			});
			const inputRuntime = yield* applyLineRunPlanFx({
				job,
				plan: resolution.plan,
				runtime,
			});
			const nextRuntime = {
				...inputRuntime,
				jobs: [
					...inputRuntime.jobs,
					job,
				],
			} satisfies RuntimeSchema.Type;

			return [
				{
					job,
				} satisfies StartLineResultSchema.Type,
				nextRuntime,
			] as const;
		});
	});
});
