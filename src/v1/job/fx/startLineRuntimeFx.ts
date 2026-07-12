import { Effect } from "effect";
import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { assertLineStartReadyFx } from "~/v1/job/fx/assertLineStartReadyFx";
import { createJobFx } from "~/v1/job/fx/createJobFx";
import { resolveLineStartFx } from "~/v1/job/fx/read/resolveLineStartFx";
import { applyLineRunPlanFx } from "~/v1/line/fx/run/applyLineRunPlanFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
export namespace startLineRuntimeFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}
/** Canonical internal start pipeline used by direct starts and queue dispatch. */
export const startLineRuntimeFx = Effect.fn("startLineRuntimeFx")(function* ({
	ownerItemId,
	lineId,
	runtime,
}: startLineRuntimeFx.Props) {
	const resolution = yield* resolveLineStartFx({
		ownerItemId,
		lineId,
		runtime,
	});
	const plan = yield* assertLineStartReadyFx({
		resolution,
	});
	const job = yield* createJobFx({
		ownerItemId,
		lineId,
		durationMs: plan.runtimeMs,
	});
	const inputRuntime = yield* applyLineRunPlanFx({
		job,
		plan,
		runtime,
	});
	return [
		job,
		{
			...inputRuntime,
			jobs: [
				...inputRuntime.jobs,
				job,
			],
		} satisfies RuntimeSchema.Type,
	] as const;
});
