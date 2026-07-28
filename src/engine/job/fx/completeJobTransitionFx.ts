import { Array, Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { JobCompletionOwner } from "~/engine/job/completion/JobCompletionContext";
import { completeLineJobRuntimeFx } from "~/engine/job/completion/fx/completeLineJobRuntimeFx";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { JobNotFoundError } from "~/engine/job/error/JobNotFoundError";
import { JobNotReadyError } from "~/engine/job/error/JobNotReadyError";
import { makeJobCompletionRandomFx } from "~/engine/job/random/makeJobCompletionRandomFx";
import { readItemLineFx } from "~/engine/line/fx/readItemLineFx";
import { isBoardRuntimeItemFx } from "~/engine/runtime/read/isBoardRuntimeItemFx";
import { isJobRuntimeItemFx } from "~/engine/runtime/read/isJobRuntimeItemFx";
import { isReservedRuntimeItemFx } from "~/engine/runtime/read/isReservedRuntimeItemFx";
import { removeRuntimeItemIdentityFx } from "~/engine/runtime/fx/removeRuntimeItemIdentityFx";
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

	const runtimeOwner = runtime.items.find((item) => item.id === job.ownerItemId);
	if (runtimeOwner === undefined)
		return yield* Effect.die(new Error(`Job ${job.id} owner is missing.`));
	const owner = Option.getOrUndefined(yield* isBoardRuntimeItemFx(runtimeOwner));
	if (owner === undefined)
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: runtimeOwner.id,
				location: runtimeOwner.location,
			}),
		);
	const line = yield* readItemLineFx({
		item: owner.item,
		lineId: job.lineId,
	});
	if (line === undefined)
		return yield* Effect.die(new Error(`Job ${job.id} line ${job.lineId} is missing.`));
	if (
		owner.item.type !== ItemEnumSchema.enum.Blueprint &&
		owner.item.type !== ItemEnumSchema.enum.Craft &&
		owner.item.type !== ItemEnumSchema.enum.Producer &&
		owner.item.type !== ItemEnumSchema.enum.Stash
	) {
		return yield* Effect.die(
			new Error(`Job ${job.id} owner ${owner.id} does not expose a product line.`),
		);
	}
	const consumedItems = Array.getSomes(
		yield* Effect.forEach(runtime.items, isJobRuntimeItemFx),
	).filter((item) => item.location.jobId === job.id);
	const reservations = Array.getSomes(
		yield* Effect.forEach(runtime.items, isReservedRuntimeItemFx),
	).filter((item) => item.location.jobId === job.id);
	const completionOwner = {
		...owner,
		item: owner.item,
	} satisfies JobCompletionOwner;
	let completionRuntime = {
		...runtime,
		jobs: runtime.jobs.filter((candidate) => candidate.id !== job.id),
	} satisfies RuntimeSchema.Type;
	for (const consumedItem of consumedItems) {
		completionRuntime = yield* removeRuntimeItemIdentityFx({
			item: consumedItem,
			runtime: completionRuntime,
		});
	}
	const completion = yield* makeJobCompletionRandomFx({
		job,
		program: completeLineJobRuntimeFx({
			job,
			line,
			owner: completionOwner,
			reservations,
			runtime: completionRuntime,
		}),
	});
	return {
		events: completion.events,
		runtime: completion.runtime,
	};
});
