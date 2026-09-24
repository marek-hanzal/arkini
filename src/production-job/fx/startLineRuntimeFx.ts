import { Effect } from "effect";

import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import type { TimeSchema } from "~/game-value/schema/TimeSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { reconcileOutboundDeliveriesRuntimeFx } from "~/production-delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import { settleActionUnitsFx } from "~/production-action/fx/settleActionUnitsFx";
import { applyInputRunPlanFx } from "~/production-input/fx/applyInputRunPlanFx";
import { JobQueueFullError } from "~/production-job/error/JobQueueFullError";
import { createJobIdFx } from "~/production-job/fx/createJobIdFx";
import { resolveLineStartFx } from "~/production-job/fx/resolveLineStartFx";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import { LineRunUnavailableError } from "~/production-line/error/LineRunUnavailableError";
import type { LineRun } from "~/production-line/type/LineRun";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

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
				lineUid: resolution.lineUid,
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
				lineUid: resolution.lineUid,
			}),
		);
	}

	return plan satisfies LineRun.Plan;
});

const createJobFx = Effect.fn("createJobFx")(function* ({
	ownerItemId,
	lineUid,
	durationMs,
}: {
	readonly ownerItemId: IdSchema.Type;
	readonly lineUid: IdSchema.Type;
	readonly durationMs: TimeSchema.Type;
}) {
	return {
		id: yield* createJobIdFx(),
		ownerItemId,
		lineUid,
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
			events: [] as GameEventSchema.Type[],
			runtime,
		}),
		(state, input, inputIndex) =>
			!state.runtime.jobs.some((entry) => entry.id === job.id)
				? Effect.succeed(state)
				: applyInputRunPlanFx({
						jobId: job.id,
						ownerItemId: plan.ownerItemId,
						lineUid: plan.lineUid,
						inputIndex,
						plan: input,
						runtime: state.runtime,
					}).pipe(
						Effect.map((result) => ({
							events: [
								...state.events,
								...result.events,
							],
							runtime: result.runtime,
						})),
					),
	);
});

const applyLineUnitPlansFx = Effect.fn("applyLineUnitPlansFx")(function* ({
	job,
	plan,
	runtime,
}: {
	readonly job: JobSchema.Type;
	readonly plan: LineRun.Plan;
	readonly runtime: RuntimeSchema.Type;
}) {
	if (!runtime.jobs.some((entry) => entry.id === job.id))
		return {
			runtime,
			facts: [],
		};
	return yield* settleActionUnitsFx({
		actionId: job.lineUid,
		units: plan.input.flatMap(({ units }) =>
			units === undefined
				? []
				: [
						units,
					],
		),
		ownerItemId: job.ownerItemId,
		runtime,
	});
});

export namespace startLineRuntimeFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineUid: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}
/**
 * Canonical internal start pipeline used by direct starts and queue dispatch.
 *
 * Job identity is created before inputs move because consumed and reserved
 * material locations refer to it. Input ownership and unit spending commit together.
 * Depletion outcome conditions use this start's input snapshot, including prior
 * Tick transitions, rather than the outer transaction or partially applied inputs.
 */
export const startLineRuntimeFx = Effect.fn("startLineRuntimeFx")(function* ({
	ownerItemId,
	lineUid,
	runtime,
}: startLineRuntimeFx.Props) {
	const resolution = yield* resolveLineStartFx({
		ownerItemId,
		lineUid,
		runtime,
	});
	const plan = yield* assertLineStartReadyFx({
		resolution,
	});
	const job = yield* createJobFx({
		ownerItemId,
		lineUid,
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
	const spent = yield* applyLineUnitPlansFx({
		job,
		plan,
		runtime: inputTransition.runtime,
	}).pipe(
		Effect.provideService(RuntimeFx, {
			read: Effect.succeed(runtime),
		}),
	);
	const reconciledRuntime = yield* reconcileOutboundDeliveriesRuntimeFx({
		runtime: spent.runtime,
	});
	return [
		job,
		reconciledRuntime,
		[
			...inputTransition.events,
			...spent.facts,
		],
	] as const;
});
