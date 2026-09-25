import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import { isLineAdmissionOpenFn } from "~/production-line/fn/isLineAdmissionOpenFn";
import { advanceItemSchedulesFx } from "~/item-schedule/fx/advanceItemSchedulesFx";
import { settleTerminalItemsFx } from "~/item-terminal/fx/settleTerminalItemsFx";
import { Effect } from "effect";

import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { advanceDeliveriesRuntimeFx } from "~/production-delivery/fx/advanceDeliveriesRuntimeFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { EngineFact } from "~/game-event/type/EngineFact";
import { attemptJobCompletionFx } from "~/production-job/fx/attemptJobCompletionFx";
import { attemptQueuedLineStartFx } from "~/production-job/fx/attemptQueuedLineStartFx";
import { resolveJobRunnableFx } from "~/production-job/fx/resolveJobRunnableFx";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { SimulationStepMs } from "~/simulation-time/constant/SimulationStepMs";

interface RuntimeStepResult {
	readonly facts: readonly EngineFact[];
	readonly runtime: RuntimeSchema.Type;
}

const sortJobsFn = (jobs: readonly JobSchema.Type[]) =>
	[
		...jobs,
	].sort((first, second) => first.id.localeCompare(second.id));

const readReadyMaterialJobIdsFn = (runtime: RuntimeSchema.Type) =>
	new Set(
		runtime.items.flatMap((item) => {
			if (
				(item.schedule?.remainingDurationMs !== 0 && item.remainingUnits !== 0) ||
				(item.location.scope !== LocationScopeEnumSchema.enum.Job &&
					item.location.scope !== LocationScopeEnumSchema.enum.Reserved)
			) {
				return [];
			}
			return [
				item.location.jobId,
			];
		}),
	);

const replaceJobFn = (runtime: RuntimeSchema.Type, job: JobSchema.Type): RuntimeSchema.Type => ({
	...runtime,
	jobs: runtime.jobs.map((candidate) => (candidate.id === job.id ? job : candidate)),
});

const dispatchQueueRequestFx = Effect.fn("dispatchQueueRequestFx")(function* (
	requestId: IdSchema.Type,
	runtime: RuntimeSchema.Type,
) {
	const attempt = yield* attemptQueuedLineStartFx({
		requestId,
		runtime,
	});
	if (attempt.type !== "started") return attempt;
	const owner = yield* readRuntimeItemByIdFx({
		itemId: attempt.job.ownerItemId,
		runtime,
	});

	return {
		type: "started",
		facts: [
			{
				type: "job:admitted",
				jobId: attempt.job.id,
				ownerItemId: attempt.job.ownerItemId,
				itemUid: owner.item.uid,
				lineUid: attempt.job.lineUid,
			} satisfies EngineFact,
			...attempt.facts,
		],
		runtime: attempt.runtime,
	} as const;
});

/** Retains intent order; a start, its terminal outcome, or useful delivery claims one pass. */
const dispatchIdleQueueRequestsFx = Effect.fn("dispatchIdleQueueRequestsFx")(function* (
	runtime: RuntimeSchema.Type,
) {
	const handledOwnerItemIds = new Set(runtime.jobs.map((job) => job.ownerItemId));
	const queueSnapshot = runtime.jobQueue;

	let draft = runtime;
	const facts: EngineFact[] = [];
	for (const request of queueSnapshot) {
		if (handledOwnerItemIds.has(request.ownerItemId)) continue;
		const owner = draft.items.find((item) => item.id === request.ownerItemId);
		if (
			owner?.schedule?.remainingDurationMs === 0 &&
			owner.item.terminationMode === "kill-switch" &&
			!isLineAdmissionOpenFn({
				owner,
				lineUid: request.lineUid,
			})
		)
			continue;

		const dispatched = yield* dispatchQueueRequestFx(request.id, draft);
		if (dispatched.type !== "started" && dispatched.type !== "delivery-scheduled") continue;
		handledOwnerItemIds.add(request.ownerItemId);
		draft = dispatched.runtime;
		facts.push(...dispatched.facts);
	}

	return {
		facts,
		runtime: draft,
	} satisfies RuntimeStepResult;
});

/**
 * Advances one canonical fixed simulation step from one shared step-start snapshot.
 *
 * Schedule eligibility is frozen at step start. Queue-only owners then dispatch
 * before job identities and runnable decisions are frozen in stable id order.
 * Later completions may remove those identities but cannot change who earned
 * this step. A completion tied with newly ready material wins; material that was
 * already ready at the boundary blocks its job until expiry can settle.
 */
export const advanceRuntimeStepFx = Effect.fn("advanceRuntimeStepFx")(function* (
	stepStart: RuntimeSchema.Type,
) {
	// Queue admission may trigger terminal work. New scheduled
	// identities earn time only from the next boundary, regardless of that output path.
	const boundaryStart = yield* dispatchIdleQueueRequestsFx(stepStart);
	const deliveryStart = yield* advanceDeliveriesRuntimeFx(boundaryStart.runtime);
	const jobs = sortJobsFn(deliveryStart.runtime.jobs);
	const readyMaterialJobIds = readReadyMaterialJobIdsFn(deliveryStart.runtime);
	const runnableByJobId = new Map<IdSchema.Type, boolean>();
	for (const job of jobs) {
		runnableByJobId.set(
			job.id,
			job.remainingMs === 0
				? false
				: yield* resolveJobRunnableFx({
						job,
						runtime: deliveryStart.runtime,
					}),
		);
	}

	let draft = deliveryStart.runtime;
	for (const job of jobs) {
		if (job.remainingMs === 0 || runnableByJobId.get(job.id) !== true) continue;
		const liveJob = draft.jobs.find((candidate) => candidate.id === job.id);
		if (liveJob === undefined) continue;
		draft = replaceJobFn(draft, {
			...liveJob,
			remainingMs: Math.max(0, liveJob.remainingMs - SimulationStepMs),
		});
	}

	const facts: EngineFact[] = [
		...boundaryStart.facts,
		...deliveryStart.events,
	];
	const completedOwnerItemIds: IdSchema.Type[] = [];
	for (const job of jobs) {
		const liveJob = draft.jobs.find((candidate) => candidate.id === job.id);
		if (
			liveJob === undefined ||
			liveJob.remainingMs !== 0 ||
			readyMaterialJobIds.has(liveJob.id)
		)
			continue;
		const completion = yield* attemptJobCompletionFx({
			jobId: liveJob.id,
			runtime: draft,
		});
		if (completion.type === "blocked") continue;
		const completedOwner = yield* readRuntimeItemByIdFx({
			itemId: liveJob.ownerItemId,
			runtime: draft,
		});
		draft = completion.runtime;
		facts.push({
			type: GameEventEnumSchema.enum.JobCompleted,
			jobId: liveJob.id,
			ownerItemId: liveJob.ownerItemId,
			itemUid: completedOwner.item.uid,
			lineUid: liveJob.lineUid,
		});
		facts.push(...completion.facts);
		completedOwnerItemIds.push(liveJob.ownerItemId);
	}

	const scheduled = yield* advanceItemSchedulesFx({
		stepStart,
		runtime: draft,
	});
	draft = scheduled.runtime;
	facts.push(...scheduled.facts);
	if (completedOwnerItemIds.length > 0 || scheduled.dispatched) {
		const dispatched = yield* dispatchIdleQueueRequestsFx(draft);
		draft = dispatched.runtime;
		facts.push(...dispatched.facts);
	}

	const expired = yield* settleTerminalItemsFx(draft);
	draft = expired.runtime;
	facts.push(...expired.facts);
	if (expired.facts.length > 0) {
		const dispatched = yield* dispatchIdleQueueRequestsFx(draft);
		draft = dispatched.runtime;
		facts.push(...dispatched.facts);
	}
	return {
		facts,
		runtime: draft,
	} satisfies RuntimeStepResult;
});
