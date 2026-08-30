import { Effect, Random } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { readOutputPlacementItemEventsFx } from "~/game-event/fx/readOutputPlacementItemEventsFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import { applyOutputPlacementFx } from "~/item-placement/fx/applyOutputPlacementFx";
import { isExpectedPlacementDeliveryBlockFn } from "~/item-placement/fn/isExpectedPlacementDeliveryBlockFn";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { outputFx } from "~/production-output/fx/outputFx";

/** Bump only when intentionally changing temporary-expiry random compatibility. */
const TemporaryExpiryRandomVersion = 2;

interface AttemptTemporaryItemExpiryProps {
	itemId: IdSchema.Type;
	runtime: RuntimeSchema.Type;
}

type AttemptTemporaryItemExpiryResult =
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

interface CompleteTemporaryItemExpiryTransitionResult {
	readonly events: readonly GameEventSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}

/** Runs the owned program with deterministic random from one temporary runtime identity. */
const makeTemporaryExpiryRandomFx = Effect.fn("makeTemporaryExpiryRandomFx")(function* <
	Result,
	Error,
	Requirements,
>({
	item,
	program,
}: {
	item: RuntimeItemSchema.Type;
	program: Effect.Effect<Result, Error, Requirements>;
}) {
	return yield* program.pipe(
		Random.withSeed(
			[
				"arkini:temporary-expiry",
				`v${TemporaryExpiryRandomVersion}`,
				item.id,
				item.item.id,
			].join(":"),
		),
	);
});

/** Removes one ready temporary item and returns exact expiry and output facts. */
const completeTemporaryItemExpiryTransitionFx = Effect.fn(
	"completeTemporaryItemExpiryTransitionFx",
)(function* ({ itemId, runtime }: AttemptTemporaryItemExpiryProps) {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined)
		return yield* Effect.die(new Error(`Temporary item ${itemId} is missing.`));
	if (item.item.type !== TypeSchema.enum.Temporary) {
		return yield* Effect.die(new Error(`Runtime item ${item.id} is not temporary.`));
	}
	if (item.location.scope !== LocationScopeEnumSchema.enum.Board) {
		return yield* Effect.die(new Error(`Temporary item ${item.id} is not on the board.`));
	}
	if (item.remainingDurationMs !== 0) {
		return yield* Effect.die(new Error(`Temporary item ${item.id} is not ready to expire.`));
	}

	const expiredEvent = {
		type: GameEventEnumSchema.enum.ItemExpired,
		itemId: item.id,
		canonicalItemId: item.item.id,
		location: item.location,
		quantity: item.quantity,
	} satisfies GameEventSchema.Type;
	let draft: RuntimeSchema.Type = yield* removeRuntimeItemIdentityFx({
		item,
		runtime,
	});
	if (item.item.output === undefined) {
		return {
			events: [
				expiredEvent,
			],
			runtime: draft,
		} satisfies CompleteTemporaryItemExpiryTransitionResult;
	}
	const origin = item.location;
	const configuredOutput = item.item.output;

	return yield* makeTemporaryExpiryRandomFx({
		item,
		program: Effect.gen(function* () {
			const output = yield* outputFx({
				origin,
				output: configuredOutput,
			});
			if (output.drop.length === 0) {
				return {
					events: [
						expiredEvent,
					],
					runtime: draft,
				} satisfies CompleteTemporaryItemExpiryTransitionResult;
			}

			const [placement, withOutput] = yield* applyOutputPlacementFx({
				origin,
				output,
				runtime: draft,
			});
			draft = withOutput;
			const placementEvents = yield* readOutputPlacementItemEventsFx({
				originItemId: item.id,
				placement,
			});

			return {
				events: [
					expiredEvent,
					...placementEvents,
				],
				runtime: draft,
			} satisfies CompleteTemporaryItemExpiryTransitionResult;
		}),
	});
});

/** Resolves one ready temporary expiry and keeps only expected delivery failures local. */
export const attemptTemporaryItemExpiryFx = Effect.fn("attemptTemporaryItemExpiryFx")(function* ({
	itemId,
	runtime,
}: AttemptTemporaryItemExpiryProps) {
	return yield* completeTemporaryItemExpiryTransitionFx({
		itemId,
		runtime,
	}).pipe(
		Effect.map(
			(completion) =>
				({
					type: "expired",
					events: completion.events,
					runtime: completion.runtime,
				}) satisfies AttemptTemporaryItemExpiryResult,
		),
		Effect.catchTag("PlacementUnavailableError", (error) =>
			isExpectedPlacementDeliveryBlockFn(error.reason)
				? Effect.succeed({
						type: "blocked",
						error,
						runtime,
					} satisfies AttemptTemporaryItemExpiryResult)
				: Effect.fail(error),
		),
	);
});
