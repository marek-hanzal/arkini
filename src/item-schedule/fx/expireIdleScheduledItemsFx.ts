import { Effect } from "effect";
import { expireItemRuntimeFx } from "~/item-expiry/fx/expireItemRuntimeFx";
import { releaseOwnerInputsFx } from "~/production-input/fx/releaseOwnerInputsFx";
import { readItemScheduleFn } from "~/item-schedule/fn/readItemScheduleFn";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { isExpectedPlacementDeliveryBlockFn } from "~/item-placement/fn/isExpectedPlacementDeliveryBlockFn";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";

/** After the ordinary queue pass, an expired idle owner has no runnable work left to preserve. */
export const expireIdleScheduledItemsFx = Effect.fn("expireIdleScheduledItemsFx")(function* (
	runtime: RuntimeSchema.Type,
) {
	let draft = runtime;
	const events: GameEventSchema.Type[] = [];
	const ids = runtime.items
		.filter((item) => item.schedule?.remainingDurationMs === 0)
		.map((item) => item.id)
		.sort();
	for (const id of ids) {
		const owner = draft.items.find((item) => item.id === id);
		if (
			owner === undefined ||
			owner.location.scope !== LocationScopeEnumSchema.enum.Board ||
			draft.jobs.some((job) => job.ownerItemId === id)
		)
			continue;
		const schedule = readItemScheduleFn(owner.item);
		if (schedule === undefined) continue;
		const origin = owner.location;
		const attempt = yield* Effect.gen(function* () {
			const expiry = yield* expireItemRuntimeFx({
				item: owner,
				origin,
				output: schedule.onExpire,
				randomSeed: [
					"arkini:scheduled-expiry",
					"v1",
					owner.id,
					owner.item.id,
				].join(":"),
				runtime: {
					...draft,
					jobQueue: draft.jobQueue.filter((request) => request.ownerItemId !== id),
				},
			});
			const release = yield* releaseOwnerInputsFx({
				owner,
				runtime: expiry.runtime,
			});
			return {
				runtime: release.runtime,
				events: [
					...expiry.events,
					...release.events,
				],
			};
		}).pipe(
			Effect.catchTag("PlacementUnavailableError", (error) =>
				isExpectedPlacementDeliveryBlockFn(error.reason)
					? Effect.succeed(undefined)
					: Effect.fail(error),
			),
		);
		if (attempt === undefined) continue;
		draft = attempt.runtime;
		events.push(...attempt.events);
	}
	return {
		runtime: draft,
		events,
	};
});
