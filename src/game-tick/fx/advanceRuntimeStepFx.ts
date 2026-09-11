import { Effect } from "effect";

import { isPassiveStorageLocationFn } from "~/item-location/fn/isPassiveStorageLocationFn";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { isInstantGameplayEnabledFn } from "~/game-runtime/fn/isInstantGameplayEnabledFn";
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
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { advanceTemporaryItemDurationsFx } from "~/temporary-item/fx/advanceTemporaryItemDurationsFx";
import { attemptTemporaryItemExpiryFx } from "~/temporary-item/fx/attemptTemporaryItemExpiryFx";

interface RuntimeStepResult {
	readonly events: readonly GameEventSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}

const sortJobsFn = (jobs: readonly JobSchema.Type[]) =>
	[
		...jobs,
	].sort((first, second) => first.id.localeCompare(second.id));

const sortTemporaryItemsFn = (runtime: RuntimeSchema.Type) =>
	runtime.items
		.filter((item) => item.item.type === TypeSchema.enum.Temporary)
		.sort((first, second) => first.id.localeCompare(second.id));

const readReadyTemporaryJobIdsFn = (runtime: RuntimeSchema.Type) =>
	new Set(
		runtime.items.flatMap((item) => {
			if (
				item.item.type !== TypeSchema.enum.Temporary ||
				item.remainingDurationMs !== 0 ||
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

	return {
		type: "started",
		events: [
			{
				type: GameEventEnumSchema.enum.JobStarted,
				jobId: attempt.job.id,
				ownerItemId: attempt.job.ownerItemId,
				lineId: attempt.job.lineId,
			} satisfies GameEventSchema.Type,
			...attempt.events,
		],
		runtime: attempt.runtime,
	} as const;
});

/** Retains intent order; only a start or useful delivery claims an idle owner for this pass. */
const dispatchIdleQueueRequestsFx = Effect.fn("dispatchIdleQueueRequestsFx")(function* (
	runtime: RuntimeSchema.Type,
) {
	const handledOwnerItemIds = new Set(runtime.jobs.map((job) => job.ownerItemId));
	const queueSnapshot = runtime.jobQueue;

	let draft = runtime;
	const events: GameEventSchema.Type[] = [];
	for (const request of queueSnapshot) {
		if (handledOwnerItemIds.has(request.ownerItemId)) continue;

		const dispatched = yield* dispatchQueueRequestFx(request.id, draft);
		if (dispatched.type !== "started" && dispatched.type !== "delivery-scheduled") continue;
		handledOwnerItemIds.add(request.ownerItemId);
		draft = dispatched.runtime;
		events.push(...dispatched.events);
	}

	return {
		events,
		runtime: draft,
	} satisfies RuntimeStepResult;
});

/**
 * Advances one canonical fixed simulation step from one shared step-start snapshot.
 *
 * Temporary eligibility is frozen at step start. Queue-only owners then dispatch
 * before job identities and runnable decisions are frozen in stable id order.
 * Later completions may remove those identities but cannot change who earned
 * this step. A completion tied with newly ready material wins; material that was
 * already ready at the boundary blocks its job until expiry can settle.
 */
export const advanceRuntimeStepFx = Effect.fn("advanceRuntimeStepFx")(function* (
	stepStart: RuntimeSchema.Type,
) {
	// Queue admission may emit external charge-depletion output. New temporary
	// identities earn time only from the next boundary, regardless of that output path.
	const temporaryItems = sortTemporaryItemsFn(stepStart);
	const boundaryStart = yield* dispatchIdleQueueRequestsFx(stepStart);
	const deliveryStart = yield* advanceDeliveriesRuntimeFx(boundaryStart.runtime);
	const instantGameplay = isInstantGameplayEnabledFn({
		runtime: deliveryStart.runtime,
	});
	const jobs = sortJobsFn(deliveryStart.runtime.jobs);
	const readyTemporaryJobIds = readReadyTemporaryJobIdsFn(deliveryStart.runtime);
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

	let draft = yield* advanceTemporaryItemDurationsFx({
		items: temporaryItems,
		runtime: deliveryStart.runtime,
	});
	for (const job of jobs) {
		if (job.remainingMs === 0 || runnableByJobId.get(job.id) !== true) continue;
		const liveJob = draft.jobs.find((candidate) => candidate.id === job.id);
		if (liveJob === undefined) continue;
		draft = replaceJobFn(draft, {
			...liveJob,
			remainingMs: instantGameplay ? 0 : Math.max(0, liveJob.remainingMs - SimulationStepMs),
		});
	}

	const events: GameEventSchema.Type[] = [
		...boundaryStart.events,
		...deliveryStart.events,
	];
	const completedOwnerItemIds: IdSchema.Type[] = [];
	for (const job of jobs) {
		const liveJob = draft.jobs.find((candidate) => candidate.id === job.id);
		if (
			liveJob === undefined ||
			liveJob.remainingMs !== 0 ||
			readyTemporaryJobIds.has(liveJob.id)
		)
			continue;
		const owner = draft.items.find((item) => item.id === liveJob.ownerItemId);
		if (owner !== undefined && isPassiveStorageLocationFn(owner.location)) continue;
		const completion = yield* attemptJobCompletionFx({
			jobId: liveJob.id,
			runtime: draft,
		});
		if (completion.type === "blocked") continue;
		draft = completion.runtime;
		events.push({
			type: GameEventEnumSchema.enum.JobCompleted,
			jobId: liveJob.id,
			ownerItemId: liveJob.ownerItemId,
			lineId: liveJob.lineId,
		});
		events.push(...completion.events);
		completedOwnerItemIds.push(liveJob.ownerItemId);
	}

	if (completedOwnerItemIds.length > 0) {
		const dispatched = yield* dispatchIdleQueueRequestsFx(draft);
		draft = dispatched.runtime;
		events.push(...dispatched.events);
	}

	let didExpireTemporaryItem = false;
	for (const temporaryItem of temporaryItems) {
		const liveItem = draft.items.find((candidate) => candidate.id === temporaryItem.id);
		if (liveItem?.item.type !== TypeSchema.enum.Temporary || liveItem.remainingDurationMs !== 0)
			continue;
		const expiry = yield* attemptTemporaryItemExpiryFx({
			itemId: liveItem.id,
			runtime: draft,
		});
		if (expiry.type === "blocked") continue;
		draft = expiry.runtime;
		events.push(...expiry.events);
		didExpireTemporaryItem = true;
	}
	if (didExpireTemporaryItem) {
		const dispatched = yield* dispatchIdleQueueRequestsFx(draft);
		draft = dispatched.runtime;
		events.push(...dispatched.events);
	}
	return {
		events,
		runtime: draft,
	} satisfies RuntimeStepResult;
});
