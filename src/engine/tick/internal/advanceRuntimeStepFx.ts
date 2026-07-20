import { Effect } from "effect";
import { isPassiveStorageLocation } from "~/engine/location/read/isPassiveStorageLocation";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { advanceTemporaryItemDurationsFx } from "~/engine/item/temporary/fx/advanceTemporaryItemDurationsFx";
import { attemptTemporaryItemExpiryFx } from "~/engine/item/temporary/fx/attemptTemporaryItemExpiryFx";
import { attemptJobCompletionFx } from "~/engine/job/fx/attemptJobCompletionFx";
import { attemptQueuedLineStartFx } from "~/engine/job/fx/attemptQueuedLineStartFx";
import { resolveJobRunnableFx } from "~/engine/job/fx/resolveJobRunnableFx";
import type { JobSchema } from "~/engine/job/schema/JobSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { TickStepMs } from "~/engine/tick/TickStepMs";

export interface RuntimeStepResult {
	readonly events: readonly GameEventSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}

const sortJobs = (jobs: readonly JobSchema.Type[]) =>
	[
		...jobs,
	].sort((first, second) => first.id.localeCompare(second.id));

const sortTemporaryItems = (runtime: RuntimeSchema.Type) =>
	runtime.items
		.filter((item) => item.item.type === "temporary")
		.sort((first, second) => first.id.localeCompare(second.id));

const replaceJob = (runtime: RuntimeSchema.Type, job: JobSchema.Type): RuntimeSchema.Type => ({
	...runtime,
	jobs: runtime.jobs.map((candidate) => (candidate.id === job.id ? job : candidate)),
});

const dispatchOwnerQueueFx = Effect.fn("dispatchOwnerQueueFx")(function* (
	ownerItemId: IdSchema.Type,
	runtime: RuntimeSchema.Type,
) {
	const attempt = yield* attemptQueuedLineStartFx({
		ownerItemId,
		runtime,
	});
	if (attempt.type !== "started") return attempt;

	return {
		type: "started",
		event: {
			type: "job:started",
			jobId: attempt.job.id,
			ownerItemId: attempt.job.ownerItemId,
			lineId: attempt.job.lineId,
			source: "queue",
		} satisfies GameEventSchema.Type,
		runtime: attempt.runtime,
	} as const;
});

const dispatchQueueOnlyOwnersFx = Effect.fn("dispatchQueueOnlyOwnersFx")(function* (
	runtime: RuntimeSchema.Type,
) {
	const activeOwnerItemIds = new Set(runtime.jobs.map((job) => job.ownerItemId));
	const queueOnlyOwnerItemIds = [
		...new Set(
			(runtime.jobQueue ?? [])
				.map((request) => request.ownerItemId)
				.filter((ownerItemId) => !activeOwnerItemIds.has(ownerItemId)),
		),
	].sort((first, second) => first.localeCompare(second));

	let draft = runtime;
	const events: GameEventSchema.Type[] = [];
	for (const ownerItemId of queueOnlyOwnerItemIds) {
		const dispatched = yield* dispatchOwnerQueueFx(ownerItemId, draft);
		if (dispatched.type !== "started") continue;
		draft = dispatched.runtime;
		events.push(dispatched.event);
	}

	return {
		events,
		runtime: draft,
	} satisfies RuntimeStepResult;
});

/** Advances one canonical fixed simulation step from one shared step-start snapshot. */
export const advanceRuntimeStepFx = Effect.fn("advanceRuntimeStepFx")(function* (
	stepStart: RuntimeSchema.Type,
) {
	const boundaryStart = yield* dispatchQueueOnlyOwnersFx(stepStart);
	const jobs = sortJobs(boundaryStart.runtime.jobs);
	const temporaryItems = sortTemporaryItems(boundaryStart.runtime);
	const runnableByJobId = new Map<IdSchema.Type, boolean>();
	for (const job of jobs) {
		runnableByJobId.set(
			job.id,
			job.remainingMs === 0
				? false
				: yield* resolveJobRunnableFx({
						job,
						runtime: boundaryStart.runtime,
					}),
		);
	}

	let draft = yield* advanceTemporaryItemDurationsFx({
		items: temporaryItems,
		runtime: boundaryStart.runtime,
	});
	for (const job of jobs) {
		if (job.remainingMs === 0 || runnableByJobId.get(job.id) !== true) continue;
		const liveJob = draft.jobs.find((candidate) => candidate.id === job.id);
		if (liveJob === undefined) continue;
		draft = replaceJob(draft, {
			...liveJob,
			remainingMs: Math.max(0, liveJob.remainingMs - TickStepMs),
		});
	}

	const events: GameEventSchema.Type[] = [
		...boundaryStart.events,
	];
	const completedOwnerItemIds: IdSchema.Type[] = [];
	for (const job of jobs) {
		const liveJob = draft.jobs.find((candidate) => candidate.id === job.id);
		if (liveJob === undefined || liveJob.remainingMs !== 0) continue;
		const owner = draft.items.find((item) => item.id === liveJob.ownerItemId);
		if (owner !== undefined && isPassiveStorageLocation(owner.location)) continue;
		const completion = yield* attemptJobCompletionFx({
			jobId: liveJob.id,
			runtime: draft,
		});
		if (completion.type === "blocked") continue;
		draft = completion.runtime;
		events.push({
			type: "job:completed",
			jobId: liveJob.id,
			ownerItemId: liveJob.ownerItemId,
			lineId: liveJob.lineId,
		});
		completedOwnerItemIds.push(liveJob.ownerItemId);
	}

	for (const ownerItemId of [
		...new Set(completedOwnerItemIds),
	].sort((first, second) => first.localeCompare(second))) {
		const dispatched = yield* dispatchOwnerQueueFx(ownerItemId, draft);
		if (dispatched.type !== "started") continue;
		draft = dispatched.runtime;
		events.push(dispatched.event);
	}

	for (const temporaryItem of temporaryItems) {
		const liveItem = draft.items.find((candidate) => candidate.id === temporaryItem.id);
		if (liveItem?.item.type !== "temporary" || liveItem.remainingDurationMs !== 0) continue;
		const expiry = yield* attemptTemporaryItemExpiryFx({
			itemId: liveItem.id,
			runtime: draft,
		});
		if (expiry.type === "blocked") continue;
		draft = expiry.runtime;
		events.push({
			type: "item:expired",
			itemId: liveItem.id,
			canonicalItemId: liveItem.item.id,
		});
	}

	return {
		events,
		runtime: draft,
	} satisfies RuntimeStepResult;
});
