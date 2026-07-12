import { Clock, Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { assertLineStartReadyFx } from "~/v1/job/fx/assertLineStartReadyFx";
import { resolveLineStartFx } from "~/v1/job/fx/read/resolveLineStartFx";
import { createJobFx } from "~/v1/job/fx/createJobFx";
import type { StartLineResultSchema } from "~/v1/job/schema/StartLineResultSchema";
import { applyLineRunPlanFx } from "~/v1/line/fx/run/applyLineRunPlanFx";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace startLineFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
	}
}

/**
 * Atomically re-resolves one current line-start state, applies its inputs, and creates its job.
 */
export const startLineFx = Effect.fn("startLineFx")(function* ({
	ownerItemId,
	lineId,
}: startLineFx.Props) {
	return yield* modifyRuntimeFx((runtime) => {
		return Effect.gen(function* () {
			const resolution = yield* resolveLineStartFx({
				ownerItemId,
				lineId,
				runtime,
			});
			const plan = yield* assertLineStartReadyFx({
				resolution,
			});

			const startedAtMs = yield* Clock.currentTimeMillis;
			const job = yield* createJobFx({
				ownerItemId,
				lineId,
				startedAtMs,
				dueAtMs: startedAtMs + plan.runtimeMs,
			});
			const inputRuntime = yield* applyLineRunPlanFx({
				job,
				plan,
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
