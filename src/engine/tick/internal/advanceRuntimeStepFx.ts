import { Effect } from "effect";
import { isPassiveStorageLocation } from "~/engine/location/read/isPassiveStorageLocation";
import { isInstantGameplayEnabledFx } from "~/engine/cheat/read/isInstantGameplayEnabledFx";

import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { JobStartSourceEnumSchema } from "~/engine/event/schema/JobStartSourceEnumSchema";
import { StartLineResultEnumSchema } from "~/engine/job/schema/StartLineResultEnumSchema";
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
	if (attempt.type !== StartLineResultEnumSchema.enum.Started) return attempt;

	return {
		type: StartLineResultEnumSchema.enum.Started,
		events: [
			{
				type: GameEventEnumSchema.enum.JobStarted,
				jobId: attempt.job.id,
				ownerItemId: attempt.job.ownerItemId,
				lineId: attempt.job.lineId,
				source: JobStartSourceEnumSchema.enum.Queue,
			} satisfies GameEventSchema.Type,
			...attempt.events,
		],
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
		if (dispatched.type !== StartLineResultEnumSchema.enum.Started) continue;
		draft = dispatched.runtime;
		events.push(...dispatched.events);
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
	const instantGameplay = yield* isInstantGameplayEnabledFx({
		runtime: boundaryStart.runtime,
	});
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
			remainingMs: instantGameplay ? 0 : Math.max(0, liveJob.remainingMs - TickStepMs),
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
			type: GameEventEnumSchema.enum.JobCompleted,
			jobId: liveJob.id,
			ownerItemId: liveJob.ownerItemId,
			lineId: liveJob.lineId,
		});
		events.push(...completion.events);
		completedOwnerItemIds.push(liveJob.ownerItemId);
	}

	for (const ownerItemId of [
		...new Set(completedOwnerItemIds),
	].sort((first, second) => first.localeCompare(second))) {
		const dispatched = yield* dispatchOwnerQueueFx(ownerItemId, draft);
		if (dispatched.type !== StartLineResultEnumSchema.enum.Started) continue;
		draft = dispatched.runtime;
		events.push(...dispatched.events);
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
		events.push(...expiry.events);
	}

	return {
		events,
		runtime: draft,
	} satisfies RuntimeStepResult;
});
