import { Effect } from "effect";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { reconcileOutboundDeliveriesRuntimeFx } from "~/engine/delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import { assertLineOutputMaxCountFx } from "~/engine/job/fx/assertLineOutputMaxCountFx";
import { assertLineStartReadyFx } from "~/engine/job/fx/assertLineStartReadyFx";
import { createJobFx } from "~/engine/job/fx/createJobFx";
import { resolveLineStartFx } from "~/engine/job/fx/read/resolveLineStartFx";
import { isolateStatefulOwnerTransitionFx } from "~/engine/item/fx/isolateStatefulOwnerTransitionFx";
import { applyLineChargePlansFx } from "~/engine/line/fx/run/applyLineChargePlansFx";
import { applyLineRunPlanFx } from "~/engine/line/fx/run/applyLineRunPlanFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
export namespace startLineRuntimeFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}
/**
 * Canonical internal start pipeline used by direct starts and queue dispatch.
 *
 * Pure output admission runs before job identity creation or mutation. The job
 * identity is then created before inputs move because consumed and reserved
 * material locations refer to it. Stateful owner stacks are isolated last.
 */
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
	yield* assertLineOutputMaxCountFx({
		candidateId: `line-admission:${ownerItemId}:${lineId}`,
		ownerItemId,
		lineId,
		plan,
		runtime,
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
	const inputTransition = yield* applyLineRunPlanFx({
		job,
		plan,
		runtime: jobRuntime,
	});
	const charged = yield* applyLineChargePlansFx({
		job,
		plan,
		runtime: inputTransition.runtime,
	});
	const isolation = yield* isolateStatefulOwnerTransitionFx({
		ownerItemId,
		runtime: charged.runtime,
	});
	const reconciledRuntime = yield* reconcileOutboundDeliveriesRuntimeFx({
		runtime: isolation.runtime,
	});
	return [
		job,
		reconciledRuntime,
		[
			...inputTransition.events,
			...charged.events,
			...isolation.events,
		],
	] as const;
});
