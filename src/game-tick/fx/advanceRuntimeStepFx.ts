import { Effect } from "effect";

import { isPassiveStorageLocationFn } from "~/item-location/fn/isPassiveStorageLocationFn";
import { isInstantGameplayEnabledFx } from "~/engine/cheat/read/isInstantGameplayEnabledFx";
import { settleItemDeliveryRuntimeFx } from "~/production-delivery/write/settleItemDeliveryRuntimeFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { advanceTemporaryItemDurationsFx } from "~/engine/item/temporary/fx/advanceTemporaryItemDurationsFx";
import { attemptTemporaryItemExpiryFx } from "~/engine/item/temporary/fx/attemptTemporaryItemExpiryFx";
import { attemptJobCompletionFx } from "~/production-job/fx/attemptJobCompletionFx";
import { attemptQueuedLineStartFx } from "~/production-job/fx/attemptQueuedLineStartFx";
import { resolveJobRunnableFx } from "~/production-job/fx/resolveJobRunnableFx";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { TickStepMs } from "~/game-tick/constant/TickStepMs";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

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

const replaceJobFn = (runtime: RuntimeSchema.Type, job: JobSchema.Type): RuntimeSchema.Type => ({
	...runtime,
	jobs: runtime.jobs.map((candidate) => (candidate.id === job.id ? job : candidate)),
});

const advanceDeliveriesFx = Effect.fn("advanceDeliveriesFx")(function* (
	runtime: RuntimeSchema.Type,
) {
	const instantGameplay = yield* isInstantGameplayEnabledFx({
		runtime,
	});
	const deliveryIds = runtime.items
		.filter((item) => item.location.scope === LocationScopeEnumSchema.enum.Delivery)
		.map((item) => item.id)
		.sort((first, second) => first.localeCompare(second));
	let draft = runtime;
	for (const itemId of deliveryIds) {
		const liveItem = draft.items.find((item) => item.id === itemId);
		if (liveItem?.location.scope !== LocationScopeEnumSchema.enum.Delivery) continue;
		if (liveItem.location.remainingDurationMs === 0) continue;
		const advanced = {
			...liveItem,
			location: {
				...liveItem.location,
				remainingDurationMs: instantGameplay
					? 0
					: Math.max(0, liveItem.location.remainingDurationMs - TickStepMs),
			},
		};
		draft = {
			...draft,
			items: draft.items.map((item) => (item.id === itemId ? advanced : item)),
		};
	}

	const events: GameEventSchema.Type[] = [];
	for (const itemId of deliveryIds) {
		const liveItem = draft.items.find((item) => item.id === itemId);
		if (
			liveItem?.location.scope !== LocationScopeEnumSchema.enum.Delivery ||
			liveItem.location.remainingDurationMs !== 0
		)
			continue;
		const [, settledRuntime, settledEvents = []] = yield* settleItemDeliveryRuntimeFx({
			itemId,
			generation: liveItem.location.generation,
			runtime: draft,
		});
		draft = settledRuntime;
		events.push(...settledEvents);
	}

	return {
		events,
		runtime: draft,
	} satisfies RuntimeStepResult;
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

const dispatchIdleQueueHeadsFx = Effect.fn("dispatchIdleQueueHeadsFx")(function* (
	runtime: RuntimeSchema.Type,
) {
	const activeOwnerItemIds = new Set(runtime.jobs.map((job) => job.ownerItemId));
	const visitedOwnerItemIds = new Set<IdSchema.Type>();
	const queueSnapshot = runtime.jobQueue;

	let draft = runtime;
	const events: GameEventSchema.Type[] = [];
	for (const request of queueSnapshot) {
		if (visitedOwnerItemIds.has(request.ownerItemId)) continue;
		visitedOwnerItemIds.add(request.ownerItemId);
		if (activeOwnerItemIds.has(request.ownerItemId)) continue;

		const dispatched = yield* dispatchQueueRequestFx(request.id, draft);
		if (dispatched.type === "delivery-scheduled") {
			draft = dispatched.runtime;
			events.push(...dispatched.events);
			continue;
		}
		if (dispatched.type !== "started") continue;
		draft = dispatched.runtime;
		activeOwnerItemIds.add(request.ownerItemId);
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
 * Queue-only owners dispatch first. Runnable decisions and eligible identities are
 * then frozen and sorted by stable id before any draft mutation; later completions
 * may remove those identities but cannot change who earned this step. Completed
 * owners dispatch one FIFO successor before ready temporary items expire.
 */
export const advanceRuntimeStepFx = Effect.fn("advanceRuntimeStepFx")(function* (
	stepStart: RuntimeSchema.Type,
) {
	const boundaryStart = yield* dispatchIdleQueueHeadsFx(stepStart);
	const deliveryStart = yield* advanceDeliveriesFx(boundaryStart.runtime);
	const instantGameplay = yield* isInstantGameplayEnabledFx({
		runtime: deliveryStart.runtime,
	});
	const jobs = sortJobsFn(deliveryStart.runtime.jobs);
	const temporaryItems = sortTemporaryItemsFn(deliveryStart.runtime);
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
			remainingMs: instantGameplay ? 0 : Math.max(0, liveJob.remainingMs - TickStepMs),
		});
	}

	const events: GameEventSchema.Type[] = [
		...boundaryStart.events,
		...deliveryStart.events,
	];
	const completedOwnerItemIds: IdSchema.Type[] = [];
	for (const job of jobs) {
		const liveJob = draft.jobs.find((candidate) => candidate.id === job.id);
		if (liveJob === undefined || liveJob.remainingMs !== 0) continue;
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
		const dispatched = yield* dispatchIdleQueueHeadsFx(draft);
		draft = dispatched.runtime;
		events.push(...dispatched.events);
	}

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
	}
	return {
		events,
		runtime: draft,
	} satisfies RuntimeStepResult;
});
