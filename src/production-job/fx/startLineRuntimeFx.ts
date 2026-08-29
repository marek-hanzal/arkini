import { Effect } from "effect";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { TimeSchema } from "~/engine/common/schema/TimeSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { reconcileOutboundDeliveriesRuntimeFx } from "~/production-delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import { settleActionChargesFx } from "~/production-action/fx/settleActionChargesFx";
import type { applyInputMaterialConsumeRunPlanFx } from "~/production-input/fx/run/applyInputMaterialConsumeRunPlanFx";
import { applyInputRunPlanFx } from "~/production-input/fx/run/applyInputRunPlanFx";
import { JobQueueFullError } from "~/production-job/error/JobQueueFullError";
import { assertOutputCapacityFx } from "~/production-job/fx/assertOutputCapacityFx";
import { createJobIdFx } from "~/production-job/fx/createJobIdFx";
import { resolveLineStartFx } from "~/production-job/fx/read/resolveLineStartFx";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import { isolateStatefulOwnerTransitionFx } from "~/engine/item/fx/isolateStatefulOwnerTransitionFx";
import { LineRunUnavailableError } from "~/production-line/error/LineRunUnavailableError";
import type { LineRun } from "~/production-line/LineRun";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

const assertLineStartReadyFx = Effect.fn("assertLineStartReadyFx")(function* ({
	resolution,
}: {
	readonly resolution: resolveLineStartFx.Result;
}) {
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

const createJobFx = Effect.fn("createJobFx")(function* ({
	ownerItemId,
	lineId,
	durationMs,
}: {
	readonly ownerItemId: IdSchema.Type;
	readonly lineId: IdSchema.Type;
	readonly durationMs: TimeSchema.Type;
}) {
	return {
		id: yield* createJobIdFx(),
		ownerItemId,
		lineId,
		durationMs,
		remainingMs: durationMs,
	} satisfies JobSchema.Type;
});

const applyLineRunPlanFx = Effect.fn("applyLineRunPlanFx")(function* ({
	job,
	plan,
	runtime,
}: {
	readonly job: JobSchema.Type;
	readonly plan: LineRun.Plan;
	readonly runtime: RuntimeSchema.Type;
}) {
	return yield* Effect.reduce(
		plan.input,
		() => ({
			consumption: [] as applyInputMaterialConsumeRunPlanFx.Consumption[],
			events: [] as GameEventSchema.Type[],
			runtime,
		}),
		(state, input, inputIndex) =>
			applyInputRunPlanFx({
				jobId: job.id,
				ownerItemId: plan.ownerItemId,
				lineId: plan.lineId,
				inputIndex,
				plan: input,
				runtime: state.runtime,
			}).pipe(
				Effect.map((result) => ({
					consumption: [
						...state.consumption,
						...result.consumption,
					],
					events: [
						...state.events,
						...result.events,
					],
					runtime: result.runtime,
				})),
			),
	);
});

const applyLineChargePlansFx = Effect.fn("applyLineChargePlansFx")(function* ({
	job,
	plan,
	runtime,
}: {
	readonly job: JobSchema.Type;
	readonly plan: LineRun.Plan;
	readonly runtime: RuntimeSchema.Type;
}) {
	return yield* settleActionChargesFx({
		actionId: job.lineId,
		charges: plan.input.flatMap(({ charges }) =>
			charges === undefined
				? []
				: [
						charges,
					],
		),
		ownerItemId: job.ownerItemId,
		runtime,
	});
});

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
	yield* assertOutputCapacityFx({
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
