import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { JobCompletionOwner } from "~/v1/job/completion/JobCompletionContext";
import { completeLineJobRuntimeFx } from "~/v1/job/completion/fx/completeLineJobRuntimeFx";
import { ItemNotOnBoardError } from "~/v1/item/error/ItemNotOnBoardError";
import { JobNotFoundError } from "~/v1/job/error/JobNotFoundError";
import { JobNotReadyError } from "~/v1/job/error/JobNotReadyError";
import { makeJobCompletionRandomFx } from "~/v1/job/random/makeJobCompletionRandomFx";
import { readItemLineFx } from "~/v1/line/fx/readItemLineFx";
import { isBoardRuntimeItem } from "~/v1/runtime/read/isBoardRuntimeItem";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace completeJobRuntimeFx {
	export interface Props {
		jobId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Resolves one ready job once and applies line output plus charge depletion lifecycle. */
export const completeJobRuntimeFx = Effect.fn("completeJobRuntimeFx")(function* ({
	jobId,
	runtime,
}: completeJobRuntimeFx.Props) {
	const job = runtime.jobs.find((candidate) => candidate.id === jobId);
	if (job === undefined)
		return yield* Effect.fail(
			new JobNotFoundError({
				jobId,
			}),
		);
	if (job.remainingMs !== 0)
		return yield* Effect.fail(
			new JobNotReadyError({
				jobId: job.id,
				remainingMs: job.remainingMs,
			}),
		);

	const owner = runtime.items.find((item) => item.id === job.ownerItemId);
	if (owner === undefined) return yield* Effect.dieMessage(`Job ${job.id} owner is missing.`);
	if (!isBoardRuntimeItem(owner))
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: owner.id,
				location: owner.location,
			}),
		);
	const line = yield* readItemLineFx({
		item: owner.item,
		lineId: job.lineId,
	});
	if (line === undefined)
		return yield* Effect.dieMessage(`Job ${job.id} line ${job.lineId} is missing.`);
	const reservations = runtime.items.filter(
		(item) => item.location.scope === "job" && item.location.jobId === job.id,
	);
	const completionRuntime = {
		...runtime,
		items: runtime.items.filter((item) => !reservations.includes(item)),
		jobs: runtime.jobs.filter((candidate) => candidate.id !== job.id),
	} satisfies RuntimeSchema.Type;
	const random = yield* makeJobCompletionRandomFx(job);

	return yield* completeLineJobRuntimeFx({
		job,
		line,
		owner: owner as JobCompletionOwner,
		reservations,
		runtime: completionRuntime,
	}).pipe(Effect.withRandom(random));
});
