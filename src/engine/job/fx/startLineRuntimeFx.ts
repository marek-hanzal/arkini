import { Effect } from "effect";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { assertJobOutputMaxCountFx } from "~/engine/job/fx/assertJobOutputMaxCountFx";
import { assertLineStartReadyFx } from "~/engine/job/fx/assertLineStartReadyFx";
import { createJobFx } from "~/engine/job/fx/createJobFx";
import { resolveLineStartFx } from "~/engine/job/fx/read/resolveLineStartFx";
import { isolateStatefulOwnerFx } from "~/engine/item/fx/isolateStatefulOwnerFx";
import { applyLineRunPlanFx } from "~/engine/line/fx/run/applyLineRunPlanFx";
import { applyLineChargePlansFx } from "~/engine/line/fx/run/applyLineChargePlansFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
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
	const jobRuntime = {
		...runtime,
		jobs: [
			...runtime.jobs,
			job,
		],
	} satisfies RuntimeSchema.Type;
	const inputRuntime = yield* applyLineRunPlanFx({
		job,
		plan,
		runtime: jobRuntime,
	});
	const chargedRuntime = yield* applyLineChargePlansFx({
		job,
		plan,
		runtime: inputRuntime,
	});
	yield* assertJobOutputMaxCountFx({
		job,
		runtime: chargedRuntime,
	});
	const ownerRuntime = yield* isolateStatefulOwnerFx({
		ownerItemId,
		runtime: chargedRuntime,
	});
	return [
		job,
		ownerRuntime,
	] as const;
});
