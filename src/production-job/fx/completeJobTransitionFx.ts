import { Array, Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { JobCompletionOwner } from "~/production-job/completion/JobCompletionContext";
import { completeLineJobRuntimeFx } from "~/production-job/completion/fx/completeLineJobRuntimeFx";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import type { JobRuntimeItemSchema } from "~/game-runtime/schema/JobRuntimeItemSchema";
import type { ReservedRuntimeItemSchema } from "~/game-runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { JobNotFoundError } from "~/production-job/error/JobNotFoundError";
import { JobNotReadyError } from "~/production-job/error/JobNotReadyError";
import { makeJobCompletionRandomFx } from "~/production-job/random/makeJobCompletionRandomFx";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import { isBoardRuntimeItemFn } from "~/game-runtime/read/fn/isBoardRuntimeItemFn";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

const isJobRuntimeItemFn = (item: RuntimeItemSchema.Type) =>
	Option.liftPredicate(
		item,
		(candidate): candidate is JobRuntimeItemSchema.Type =>
			candidate.location.scope === LocationScopeEnumSchema.enum.Job,
	);

const isReservedRuntimeItemFn = (item: RuntimeItemSchema.Type) =>
	Option.liftPredicate(
		item,
		(candidate): candidate is ReservedRuntimeItemSchema.Type =>
			candidate.location.scope === LocationScopeEnumSchema.enum.Reserved,
	);

interface CompleteJobTransitionProps {
	jobId: IdSchema.Type;
	runtime: RuntimeSchema.Type;
}

/** Resolves one ready job once and applies line output plus charge depletion lifecycle. */
export const completeJobTransitionFx = Effect.fn("completeJobTransitionFx")(function* ({
	jobId,
	runtime,
}: CompleteJobTransitionProps) {
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
	const owner = Option.getOrUndefined(isBoardRuntimeItemFn(runtimeOwner));
	if (owner === undefined)
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: runtimeOwner.id,
				location: runtimeOwner.location,
			}),
		);
	const line = readItemLineFn({
		item: owner.item,
		lineId: job.lineId,
	});
	if (line === undefined)
		return yield* Effect.die(new Error(`Job ${job.id} line ${job.lineId} is missing.`));
	if (
		owner.item.type !== TypeSchema.enum.Blueprint &&
		owner.item.type !== TypeSchema.enum.Craft &&
		owner.item.type !== TypeSchema.enum.Deposit &&
		owner.item.type !== TypeSchema.enum.Producer &&
		owner.item.type !== TypeSchema.enum.Stash
	) {
		return yield* Effect.die(
			new Error(`Job ${job.id} owner ${owner.id} does not expose a product line.`),
		);
	}
	const consumedItems = Array.getSomes(runtime.items.map(isJobRuntimeItemFn)).filter(
		(item) => item.location.jobId === job.id,
	);
	const reservations = Array.getSomes(runtime.items.map(isReservedRuntimeItemFn)).filter(
		(item) => item.location.jobId === job.id,
	);
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
