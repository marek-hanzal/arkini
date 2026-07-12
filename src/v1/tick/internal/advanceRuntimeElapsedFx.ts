import { Effect } from "effect";

import type { GameEventSchema } from "~/v1/event/schema/GameEventSchema";
import { completeJobRuntimeFx } from "~/v1/job/fx/completeJobRuntimeFx";
import { resolveJobRunnableFx } from "~/v1/job/fx/resolveJobRunnableFx";
import { reviseJobFx } from "~/v1/job/fx/reviseJobFx";
import { startLineRuntimeFx } from "~/v1/job/fx/startLineRuntimeFx";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

interface OwnerAdvanceResult {
	readonly events: readonly GameEventSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}

const advanceOwnerFx = Effect.fn("advanceOwnerFx")(function* (
	ownerItemId: string,
	elapsedMs: number,
	initial: RuntimeSchema.Type,
) {
	let budgetMs = elapsedMs;
	let draft = initial;
	const events: GameEventSchema.Type[] = [];
	while (true) {
		const job = draft.jobs.find((candidate) => candidate.ownerItemId === ownerItemId);
		if (job === undefined) break;
		const runnable = yield* resolveJobRunnableFx({
			job,
			runtime: draft,
		});
		if (!runnable) break;
		if (job.remainingMs > budgetMs) {
			const revised = yield* reviseJobFx({
				...job,
				remainingMs: job.remainingMs - budgetMs,
			});
			draft = {
				...draft,
				jobs: draft.jobs.map((candidate) =>
					candidate.id === job.id ? revised : candidate,
				),
			};
			break;
		}
		budgetMs -= job.remainingMs;
		draft = yield* completeJobRuntimeFx({
			job,
			runtime: draft,
		});
		events.push({
			type: "job:completed",
			jobId: job.id,
			ownerItemId: job.ownerItemId,
			lineId: job.lineId,
		});
		const requestIndex = (draft.jobQueue ?? []).findIndex(
			(request) => request.ownerItemId === ownerItemId,
		);
		if (requestIndex < 0) break;
		const request = (draft.jobQueue ?? [])[requestIndex];
		if (request === undefined) break;
		const withoutRequest = {
			...draft,
			jobQueue: (draft.jobQueue ?? []).filter((_, index) => index !== requestIndex),
		};
		const started = yield* Effect.either(
			startLineRuntimeFx({
				ownerItemId: request.ownerItemId,
				lineId: request.lineId,
				runtime: withoutRequest,
			}),
		);
		if (started._tag === "Left") break;
		const [nextJob, nextRuntime] = started.right;
		draft = nextRuntime;
		events.push({
			type: "job:started",
			jobId: nextJob.id,
			ownerItemId: nextJob.ownerItemId,
			lineId: nextJob.lineId,
			source: "queue",
		});
		if (budgetMs === 0 && nextJob.remainingMs > 0) break;
	}
	return {
		events,
		runtime: draft,
	} satisfies OwnerAdvanceResult;
});

export namespace advanceRuntimeElapsedFx {
	export interface Props {
		elapsedMs: number;
	}
}

/** Applies one already-acquired elapsed budget to the current runtime. */
export const advanceRuntimeElapsedFx = Effect.fn("advanceRuntimeElapsedFx")(function* ({
	elapsedMs,
}: advanceRuntimeElapsedFx.Props) {
	yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			let draft = runtime;
			const events: GameEventSchema.Type[] = [];
			const owners = [
				...new Set(runtime.jobs.map((job) => job.ownerItemId)),
			];
			for (const ownerItemId of owners) {
				const advanced = yield* advanceOwnerFx(ownerItemId, elapsedMs, draft);
				draft = advanced.runtime;
				events.push(...advanced.events);
			}
			return [
				undefined,
				draft,
				events,
			] as const;
		}),
	);
});
