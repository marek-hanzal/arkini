import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import { readItemScheduleFn } from "~/item-schedule/fn/readItemScheduleFn";
import { advanceItemSchedulesFx } from "~/item-schedule/fx/advanceItemSchedulesFx";
import { expireIdleScheduledItemsFx } from "~/item-schedule/fx/expireIdleScheduledItemsFx";
import { Effect } from "effect";

import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { advanceDeliveriesRuntimeFx } from "~/production-delivery/fx/advanceDeliveriesRuntimeFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { attemptJobCompletionFx } from "~/production-job/fx/attemptJobCompletionFx";
import { attemptQueuedLineStartFx } from "~/production-job/fx/attemptQueuedLineStartFx";
import { resolveJobRunnableFx } from "~/production-job/fx/resolveJobRunnableFx";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { SimulationStepMs } from "~/simulation-time/constant/SimulationStepMs";

interface RuntimeStepResult {
	readonly events: readonly GameEventSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}

interface AutofillAdmission {
	readonly event: Extract<
		GameEventSchema.Type,
		{
			type: "line-input:autofill-started";
		}
	>;
	readonly deliveryItemIds: readonly IdSchema.Type[];
}

interface QueueDispatchResult extends RuntimeStepResult {
	readonly autofillAdmissions: readonly AutofillAdmission[];
}

const sortJobsFn = (jobs: readonly JobSchema.Type[]) =>
	[
		...jobs,
	].sort((first, second) => first.id.localeCompare(second.id));

const readReadyMaterialJobIdsFn = (runtime: RuntimeSchema.Type) =>
	new Set(
		runtime.items.flatMap((item) => {
			if (
				item.schedule?.remainingDurationMs !== 0 ||
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
	// A payer's depletion outcome may reset its space after start admission,
	// removing the new job before this transition publishes any events.
	if (!attempt.runtime.jobs.some((job) => job.id === attempt.job.id)) {
		return {
			type: "settled",
			events: attempt.events,
			runtime: attempt.runtime,
		} as const;
	}
	const owner = yield* readRuntimeItemByIdFx({
		itemId: attempt.job.ownerItemId,
		runtime,
	});

	return {
		type: "started",
		events: [
			{
				type: GameEventEnumSchema.enum.JobStarted,
				jobId: attempt.job.id,
				ownerItemId: attempt.job.ownerItemId,
				itemUid: owner.item.uid,
				lineId: attempt.job.lineId,
			} satisfies GameEventSchema.Type,
			...attempt.events,
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
	const events: GameEventSchema.Type[] = [];
	const autofillAdmissions: AutofillAdmission[] = [];
	for (const request of queueSnapshot) {
		if (handledOwnerItemIds.has(request.ownerItemId)) continue;
		const owner = draft.items.find((item) => item.id === request.ownerItemId);
		if (
			owner?.schedule?.remainingDurationMs === 0 &&
			readItemScheduleFn(owner.item)?.expiryMode === "kill-switch"
		)
			continue;

		const dispatched = yield* dispatchQueueRequestFx(request.id, draft);
		if (
			dispatched.type !== "started" &&
			dispatched.type !== "settled" &&
			dispatched.type !== "delivery-scheduled"
		)
			continue;
		handledOwnerItemIds.add(request.ownerItemId);
		draft = dispatched.runtime;
		events.push(...dispatched.events);
		if (dispatched.type === "delivery-scheduled") {
			for (const event of dispatched.events) {
				if (event.type === GameEventEnumSchema.enum.LineInputAutofillStarted)
					autofillAdmissions.push({
						event,
						deliveryItemIds: dispatched.deliveryItemIds,
					});
			}
		}
	}

	return {
		events,
		autofillAdmissions,
		runtime: draft,
	} satisfies QueueDispatchResult;
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
	// Queue admission may emit external unit-depletion output. New scheduled
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

	const events: GameEventSchema.Type[] = [
		...boundaryStart.events,
		...deliveryStart.events,
	];
	const autofillAdmissions: AutofillAdmission[] = [
		...boundaryStart.autofillAdmissions,
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
		events.push({
			type: GameEventEnumSchema.enum.JobCompleted,
			jobId: liveJob.id,
			ownerItemId: liveJob.ownerItemId,
			itemUid: completedOwner.item.uid,
			lineId: liveJob.lineId,
		});
		events.push(...completion.events);
		completedOwnerItemIds.push(liveJob.ownerItemId);
	}

	const scheduled = yield* advanceItemSchedulesFx({
		stepStart,
		runtime: draft,
	});
	draft = scheduled.runtime;
	events.push(...scheduled.events);
	if (completedOwnerItemIds.length > 0 || scheduled.dispatched) {
		const dispatched = yield* dispatchIdleQueueRequestsFx(draft);
		draft = dispatched.runtime;
		events.push(...dispatched.events);
		autofillAdmissions.push(...dispatched.autofillAdmissions);
	}

	const expired = yield* expireIdleScheduledItemsFx(draft);
	draft = expired.runtime;
	events.push(...expired.events);
	if (expired.events.length > 0) {
		const dispatched = yield* dispatchIdleQueueRequestsFx(draft);
		draft = dispatched.runtime;
		events.push(...dispatched.events);
		autofillAdmissions.push(...dispatched.autofillAdmissions);
	}
	const finalItemsById = new Map(
		draft.items.map(
			(item) =>
				[
					item.id,
					item,
				] as const,
		),
	);
	const survivingAutofillByEvent = new Map(
		autofillAdmissions.map(
			({ event, deliveryItemIds }) =>
				[
					event,
					deliveryItemIds.filter((id) => {
						const item = finalItemsById.get(id);
						return (
							item?.location.scope === LocationScopeEnumSchema.enum.Delivery &&
							item.location.phase === "outbound" &&
							item.location.target.kind === "line-input" &&
							item.location.target.ownerItemId === event.ownerItemId &&
							item.location.target.lineId === event.lineId
						);
					}).length,
				] as const,
		),
	);
	const liveOrSettledJobIds = new Set(draft.jobs.map((job) => job.id));
	for (const event of events) {
		if (
			event.type === GameEventEnumSchema.enum.JobCompleted ||
			event.type === GameEventEnumSchema.enum.JobAborted
		)
			liveOrSettledJobIds.add(event.jobId);
	}
	return {
		// A later outcome in this step may erase an admitted job before publication.
		events: events.flatMap((event) => {
			if (
				event.type === GameEventEnumSchema.enum.JobStarted &&
				!liveOrSettledJobIds.has(event.jobId)
			)
				return [];
			if (event.type === GameEventEnumSchema.enum.LineInputAutofillStarted) {
				const survivingQuantity = survivingAutofillByEvent.get(event);
				if (survivingQuantity !== undefined) {
					return survivingQuantity > 0
						? [
								{
									...event,
									scheduledQuantity: survivingQuantity,
								},
							]
						: [];
				}
			}
			return [
				event,
			];
		}),
		runtime: draft,
	} satisfies RuntimeStepResult;
});
