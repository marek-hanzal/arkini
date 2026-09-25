import { Array, Effect, Option } from "effect";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { settleJobRuntimeFx } from "~/production-job/fx/settleJobRuntimeFx";
import { ItemNotOnBoardError } from "~/item-location/error/ItemNotOnBoardError";
import type { JobRuntimeItemSchema } from "~/game-runtime/schema/JobRuntimeItemSchema";
import type { ReservedRuntimeItemSchema } from "~/game-runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { JobNotFoundError } from "~/production-job/error/JobNotFoundError";
import { JobNotReadyError } from "~/production-job/error/JobNotReadyError";
import { makeJobSettlementRandomFx } from "~/production-job/fx/makeJobSettlementRandomFx";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import { readScheduledLineOwnerExitFn } from "~/item-schedule/fn/readScheduledLineOwnerExitFn";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
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

/**
 * Resolves one ready job once and applies line outcome plus unit depletion lifecycle.
 * Output conditions share this completion's input snapshot, including earlier Tick
 * transitions but excluding this completion's partial candidate.
 */
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
	const owner = Option.getOrUndefined(narrowBoardRuntimeItemFn(runtimeOwner));
	if (owner === undefined)
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: runtimeOwner.id,
				location: runtimeOwner.location,
			}),
		);
	const line = readItemLineFn({
		item: owner.item,
		lineUid: job.lineUid,
	});
	if (line === undefined)
		return yield* Effect.die(new Error(`Job ${job.id} line ${job.lineUid} is missing.`));
	const consumedItems = Array.getSomes(runtime.items.map(isJobRuntimeItemFn)).filter(
		(item) => item.location.jobId === job.id,
	);
	const reservations = Array.getSomes(runtime.items.map(isReservedRuntimeItemFn)).filter(
		(item) => item.location.jobId === job.id,
	);
	const completionOwner = owner;
	const ownerExit = readScheduledLineOwnerExitFn({
		owner,
		line,
	});
	let completionRuntime = {
		...runtime,
		jobs: runtime.jobs.filter((candidate) => candidate.id !== job.id),
	} satisfies RuntimeSchema.Type;
	const removalEvents: GameEventSchema.Type[] = [];
	for (const consumedItem of consumedItems) {
		if (!completionRuntime.items.some((item) => item.id === consumedItem.id)) continue;
		const removed = yield* removeRuntimeItemIdentityFx({
			ownershipRuntime: runtime,
			item: consumedItem,
			runtime: completionRuntime,
		});
		completionRuntime = removed.runtime;
		removalEvents.push(...removed.events);
	}
	const completion = yield* makeJobSettlementRandomFx({
		job,
		program: settleJobRuntimeFx({
			job,
			lineOutcome: line.outcome,
			ownerExit,
			owner: completionOwner,
			reservations,
			runtime: completionRuntime,
		}).pipe(
			Effect.provideService(RuntimeFx, {
				read: Effect.succeed(runtime),
			}),
		),
	});
	return {
		facts: [
			...removalEvents,
			...completion.facts,
		],
		runtime: completion.runtime,
	};
});
