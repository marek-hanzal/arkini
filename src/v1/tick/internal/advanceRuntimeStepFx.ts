import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { GameEventSchema } from "~/v1/event/schema/GameEventSchema";
import { completeJobRuntimeFx } from "~/v1/job/fx/completeJobRuntimeFx";
import { resolveJobRunnableFx } from "~/v1/job/fx/resolveJobRunnableFx";
import { reviseJobFx } from "~/v1/job/fx/reviseJobFx";
import { startLineRuntimeFx } from "~/v1/job/fx/startLineRuntimeFx";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { TickStepMs } from "~/v1/tick/TickStepMs";

export interface RuntimeStepResult {
	readonly events: readonly GameEventSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}

const sortJobs = (jobs: readonly JobSchema.Type[]) =>
	[
		...jobs,
	].sort((first, second) => first.id.localeCompare(second.id));

const replaceJob = (runtime: RuntimeSchema.Type, job: JobSchema.Type): RuntimeSchema.Type => ({
	...runtime,
	jobs: runtime.jobs.map((candidate) => (candidate.id === job.id ? job : candidate)),
});

const dispatchOwnerQueueFx = Effect.fn("dispatchOwnerQueueFx")(function* (
	ownerItemId: IdSchema.Type,
	runtime: RuntimeSchema.Type,
) {
	const requestIndex = (runtime.jobQueue ?? []).findIndex(
		(request) => request.ownerItemId === ownerItemId,
	);
	if (requestIndex < 0) return undefined;
	const request = (runtime.jobQueue ?? [])[requestIndex];
	if (request === undefined) return undefined;
	const withoutRequest = {
		...runtime,
		jobQueue: (runtime.jobQueue ?? []).filter((_, index) => index !== requestIndex),
	};
	const started = yield* Effect.either(
		startLineRuntimeFx({
			ownerItemId: request.ownerItemId,
			lineId: request.lineId,
			runtime: withoutRequest,
		}),
	);
	if (started._tag === "Left") return undefined;
	const [job, nextRuntime] = started.right;
	return {
		event: {
			type: "job:started",
			jobId: job.id,
			ownerItemId: job.ownerItemId,
			lineId: job.lineId,
			source: "queue",
		} satisfies GameEventSchema.Type,
		runtime: nextRuntime,
	};
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
		if (dispatched === undefined) continue;
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

	let draft = boundaryStart.runtime;
	for (const job of jobs) {
		if (job.remainingMs === 0 || runnableByJobId.get(job.id) !== true) continue;
		const liveJob = draft.jobs.find((candidate) => candidate.id === job.id);
		if (liveJob === undefined) continue;
		const revised = yield* reviseJobFx({
			...liveJob,
			remainingMs: Math.max(0, liveJob.remainingMs - TickStepMs),
		});
		draft = replaceJob(draft, revised);
	}

	const events: GameEventSchema.Type[] = [
		...boundaryStart.events,
	];
	const completedOwnerItemIds: IdSchema.Type[] = [];
	for (const job of jobs) {
		const liveJob = draft.jobs.find((candidate) => candidate.id === job.id);
		if (liveJob === undefined || liveJob.remainingMs !== 0) continue;
		draft = yield* completeJobRuntimeFx({
			job: liveJob,
			runtime: draft,
		});
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
		if (dispatched === undefined) continue;
		draft = dispatched.runtime;
		events.push(dispatched.event);
	}

	return {
		events,
		runtime: draft,
	} satisfies RuntimeStepResult;
});
