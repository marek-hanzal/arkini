import { expireItemRuntimeFx } from "~/item-expiry/fx/expireItemRuntimeFx";
import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { readItemScheduleContextFx } from "~/item-schedule/fx/readItemScheduleContextFx";
import { readItemScheduleFn } from "~/item-schedule/fn/readItemScheduleFn";
import { releaseOwnerInputsFx } from "~/production-input/fx/releaseOwnerInputsFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { ItemNotOnBoardError } from "~/item-location/error/ItemNotOnBoardError";
import type { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import { isExpectedPlacementDeliveryBlockFn } from "~/item-placement/fn/isExpectedPlacementDeliveryBlockFn";
import { reconcileJobAfterMaterialExpiryFx } from "~/production-job/fx/reconcileJobAfterMaterialExpiryFx";

interface AttemptScheduledItemExpiryProps {
	itemId: IdSchema.Type;
	runtime: RuntimeSchema.Type;
}

type AttemptScheduledItemExpiryResult =
	| {
			type: "blocked";
			error: ItemNotOnBoardError | PlacementUnavailableError;
			runtime: RuntimeSchema.Type;
	  }
	| {
			type: "expired";
			events: readonly GameEventSchema.Type[];
			runtime: RuntimeSchema.Type;
	  };

interface CompleteScheduledItemExpiryTransitionResult {
	readonly events: readonly GameEventSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}

/** Removes one ready scheduled item and returns exact expiry and output facts. */
const completeScheduledItemExpiryTransitionFx = Effect.fn(
	"completeScheduledItemExpiryTransitionFx",
)(function* ({ itemId, runtime }: AttemptScheduledItemExpiryProps) {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined)
		return yield* Effect.die(new Error(`Scheduled item ${itemId} is missing.`));
	const schedule = readItemScheduleFn(item.item);
	if (schedule === undefined || item.schedule?.remainingDurationMs !== 0) {
		return yield* Effect.die(new Error(`Scheduled item ${item.id} is not ready to expire.`));
	}
	const context = yield* readItemScheduleContextFx({
		item,
		runtime,
	});

	const expiry = yield* expireItemRuntimeFx({
		item,
		origin: context.origin,
		output: schedule.onExpire,
		randomSeed: [
			"arkini:scheduled-expiry",
			"v1",
			item.id,
			item.item.id,
		].join(":"),
		runtime: {
			...runtime,
			jobQueue: runtime.jobQueue.filter((request) => request.ownerItemId !== item.id),
		},
	});
	const release = yield* releaseOwnerInputsFx({
		owner: item,
		origin: context.origin,
		runtime: expiry.runtime,
	});
	let draft = release.runtime;
	const events = [
		...expiry.events,
		...release.events,
	];
	if (context.jobId !== undefined) {
		const jobTransition = yield* reconcileJobAfterMaterialExpiryFx({
			jobId: context.jobId,
			runtime: draft,
		});
		draft = jobTransition.runtime;
		events.push(...jobTransition.events);
	}

	return {
		events,
		runtime: draft,
	} satisfies CompleteScheduledItemExpiryTransitionResult;
});

/** Resolves one ready scheduled expiry and keeps only expected delivery failures local. */
export const attemptScheduledItemExpiryFx = Effect.fn("attemptScheduledItemExpiryFx")(function* ({
	itemId,
	runtime,
}: AttemptScheduledItemExpiryProps) {
	return yield* completeScheduledItemExpiryTransitionFx({
		itemId,
		runtime,
	}).pipe(
		Effect.map(
			(completion) =>
				({
					type: "expired",
					events: completion.events,
					runtime: completion.runtime,
				}) satisfies AttemptScheduledItemExpiryResult,
		),
		Effect.catchTag("PlacementUnavailableError", (error) =>
			isExpectedPlacementDeliveryBlockFn(error.reason)
				? Effect.succeed({
						type: "blocked",
						error,
						runtime,
					} satisfies AttemptScheduledItemExpiryResult)
				: Effect.fail(error),
		),
		Effect.catchTag("ItemNotOnBoardError", (error) =>
			Effect.succeed({
				type: "blocked",
				error,
				runtime,
			} satisfies AttemptScheduledItemExpiryResult),
		),
	);
});
