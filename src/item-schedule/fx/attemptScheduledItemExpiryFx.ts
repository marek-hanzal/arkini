import { expireItemRuntimeFx } from "~/item-expiry/fx/expireItemRuntimeFx";
import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { readItemPhysicalContextFx } from "~/item-location/fx/readItemPhysicalContextFx";
import { readItemScheduleFn } from "~/item-schedule/fn/readItemScheduleFn";
import { releaseOwnerInputsFx } from "~/production-input/fx/releaseOwnerInputsFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";

interface AttemptScheduledItemExpiryProps {
	itemId: IdSchema.Type;
	runtime: RuntimeSchema.Type;
}

type AttemptScheduledItemExpiryResult =
	| {
			type: "blocked";
			error: PlacementUnavailableError;
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
	const context = yield* readItemPhysicalContextFx({
		item,
		runtime,
	});

	const force = schedule.expiryMode === "kill-switch";
	const expiry = yield* expireItemRuntimeFx({
		removalMode: force ? "kill-switch" : undefined,
		item,
		origin: context.origin,
		output: schedule.onExpire,
		randomSeed: [
			"serakki:scheduled-expiry",
			"v1",
			item.id,
			item.item.id,
		].join(":"),
		runtime: {
			...runtime,
			jobQueue: runtime.jobQueue.filter((request) => request.ownerItemId !== item.id),
		},
	});
	const release = force
		? {
				runtime: expiry.runtime,
				events: [],
			}
		: yield* releaseOwnerInputsFx({
				owner: item,
				origin: context.origin,
				runtime: expiry.runtime,
			});

	return {
		events: [
			...expiry.events,
			...release.events,
		],
		runtime: release.runtime,
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
			Effect.succeed({
				type: "blocked",
				error,
				runtime,
			} satisfies AttemptScheduledItemExpiryResult),
		),
	);
});
