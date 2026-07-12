import { Effect } from "effect";
import { completeJobRuntimeFx } from "~/v1/job/fx/completeJobRuntimeFx";
import { resolveJobRunnableFx } from "~/v1/job/fx/resolveJobRunnableFx";
import { reviseJobFx } from "~/v1/job/fx/reviseJobFx";
import { startLineRuntimeFx } from "~/v1/job/fx/startLineRuntimeFx";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { TickFx } from "~/v1/tick/context/TickFx";

const advanceOwnerFx = Effect.fn("advanceOwnerFx")(function* (
	ownerItemId: string,
	elapsedMs: number,
	initial: RuntimeSchema.Type,
) {
	let budgetMs = elapsedMs;
	let draft = initial;
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
		draft = started.right[1];
		if (budgetMs === 0 && started.right[0].remainingMs > 0) break;
	}
	return draft;
});

/** Applies one real elapsed-time tick, including whole queued chains, atomically. */
export const runTickRuntimeFx = Effect.fn("runTickRuntimeFx")(function* () {
	const tick = yield* (yield* TickFx).read;
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			let draft = runtime;
			const owners = [
				...new Set(runtime.jobs.map((job) => job.ownerItemId)),
			];
			for (const ownerItemId of owners)
				draft = yield* advanceOwnerFx(ownerItemId, tick.elapsedMs, draft);
			return [
				draft,
				draft,
			] as const;
		}),
	);
});
