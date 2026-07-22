import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { JobCompletionOwner } from "~/engine/job/completion/JobCompletionContext";
import { completeLineJobRuntimeFx } from "~/engine/job/completion/fx/completeLineJobRuntimeFx";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { JobNotFoundError } from "~/engine/job/error/JobNotFoundError";
import { JobNotReadyError } from "~/engine/job/error/JobNotReadyError";
import { makeJobCompletionRandomFx } from "~/engine/job/random/makeJobCompletionRandomFx";
import { readItemLineFx } from "~/engine/line/fx/readItemLineFx";
import { isBoardRuntimeItem } from "~/engine/runtime/read/isBoardRuntimeItem";
import { isJobRuntimeItem } from "~/engine/runtime/read/isJobRuntimeItem";
import { isReservedRuntimeItem } from "~/engine/runtime/read/isReservedRuntimeItem";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace completeJobTransitionFx {
	export interface Props {
		jobId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Resolves one ready job once and applies line output plus charge depletion lifecycle. */
export const completeJobTransitionFx = Effect.fn("completeJobTransitionFx")(function* ({
	jobId,
	runtime,
}: completeJobTransitionFx.Props) {
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
	const consumedItems = runtime.items
		.filter(isJobRuntimeItem)
		.filter((item) => item.location.jobId === job.id);
	const reservations = runtime.items
		.filter(isReservedRuntimeItem)
		.filter((item) => item.location.jobId === job.id);
	const consumedItemIds = new Set(consumedItems.map((item) => item.id));
	const completionRuntime = {
		...runtime,
		items: runtime.items.filter((item) => !consumedItemIds.has(item.id)),
		jobs: runtime.jobs.filter((candidate) => candidate.id !== job.id),
	} satisfies RuntimeSchema.Type;
	const random = yield* makeJobCompletionRandomFx(job);

	const completion = yield* completeLineJobRuntimeFx({
		job,
		line,
		owner: owner as JobCompletionOwner,
		reservations,
		runtime: completionRuntime,
	}).pipe(Effect.withRandom(random));
	return {
		events: completion.events,
		runtime: completion.runtime,
	};
});
