import { Effect, Random } from "effect";

import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { readOutputPlacementItemEventsFx } from "~/game-event/fx/readOutputPlacementItemEventsFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { readBoardRuntimeItemByIdFx } from "~/game-runtime/fx/readBoardRuntimeItemByIdFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { ItemNotOnBoardError } from "~/item-location/error/ItemNotOnBoardError";
import type { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import { applyOutputPlacementFx } from "~/item-placement/fx/applyOutputPlacementFx";
import { isExpectedPlacementDeliveryBlockFn } from "~/item-placement/fn/isExpectedPlacementDeliveryBlockFn";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { reconcileJobAfterTemporaryMaterialExpiryFx } from "~/production-job/fx/reconcileJobAfterTemporaryMaterialExpiryFx";
import { outputFx } from "~/production-output/fx/outputFx";

/** Bump only when intentionally changing temporary-expiry random compatibility. */
const TemporaryExpiryRandomVersion = 3;

interface AttemptTemporaryItemExpiryProps {
	itemId: IdSchema.Type;
	runtime: RuntimeSchema.Type;
}

type AttemptTemporaryItemExpiryResult =
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

interface CompleteTemporaryItemExpiryTransitionResult {
	readonly events: readonly GameEventSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}

interface TemporaryExpiryContext {
	readonly jobId?: IdSchema.Type;
	readonly origin: BoardLocationSchema.Type;
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

const readTemporaryExpiryOwnerOriginFx = Effect.fn("readTemporaryExpiryOwnerOriginFx")(function* ({
	ownerItemId,
	runtime,
}: {
	readonly ownerItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	return (yield* readBoardRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	})).location;
});

/** Resolves the visible Board origin represented by one temporary item's internal location. */
const readTemporaryExpiryContextFx = Effect.fn("readTemporaryExpiryContextFx")(function* ({
	item,
	runtime,
}: {
	readonly item: RuntimeItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const location = item.location;
	switch (location.scope) {
		case LocationScopeEnumSchema.enum.Board:
			return {
				origin: location,
			} satisfies TemporaryExpiryContext;
		case LocationScopeEnumSchema.enum.Delivery:
			if (location.origin.scope !== LocationScopeEnumSchema.enum.Board) {
				return yield* Effect.fail(
					new ItemNotOnBoardError({
						itemId: item.id,
						location: location.origin,
					}),
				);
			}
			return {
				origin: location.origin,
			} satisfies TemporaryExpiryContext;
		case LocationScopeEnumSchema.enum.Input:
			return {
				origin: yield* readTemporaryExpiryOwnerOriginFx({
					ownerItemId: location.ownerItemId,
					runtime,
				}),
			} satisfies TemporaryExpiryContext;
		case LocationScopeEnumSchema.enum.Job:
		case LocationScopeEnumSchema.enum.Reserved: {
			const job = runtime.jobs.find((candidate) => candidate.id === location.jobId);
			if (job === undefined) {
				return yield* Effect.die(
					new Error(`Temporary item ${item.id} job ${location.jobId} is missing.`),
				);
			}
			return {
				jobId: job.id,
				origin: yield* readTemporaryExpiryOwnerOriginFx({
					ownerItemId: job.ownerItemId,
					runtime,
				}),
			} satisfies TemporaryExpiryContext;
		}
		case LocationScopeEnumSchema.enum.Inventory:
		case LocationScopeEnumSchema.enum.Toolbar:
			return yield* Effect.die(
				new Error(`Temporary item ${item.id} has no Board expiry origin.`),
			);
	}
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
	if (item.remainingDurationMs !== 0) {
		return yield* Effect.die(new Error(`Temporary item ${item.id} is not ready to expire.`));
	}
	const context = yield* readTemporaryExpiryContextFx({
		item,
		runtime,
	});

	const expiredEvent = {
		type: GameEventEnumSchema.enum.ItemExpired,
		itemId: item.id,
		canonicalItemId: item.item.id,
		location: context.origin,
		quantity: item.quantity,
	} satisfies GameEventSchema.Type;
	let draft: RuntimeSchema.Type = yield* removeRuntimeItemIdentityFx({
		item,
		runtime,
	});
	const events: GameEventSchema.Type[] = [
		expiredEvent,
	];
	if (item.item.output !== undefined) {
		const configuredOutput = item.item.output;
		const outputTransition = yield* makeTemporaryExpiryRandomFx({
			item,
			program: Effect.gen(function* () {
				// Pin this expiry's input, not the outer Tick transaction or removed-item draft.
				const output = yield* outputFx({
					origin: context.origin,
					output: configuredOutput,
				}).pipe(
					Effect.provideService(RuntimeFx, {
						read: Effect.succeed(runtime),
					}),
				);
				if (output.drop.length === 0) {
					return {
						events: [] as GameEventSchema.Type[],
						runtime: draft,
					};
				}

				const [placement, withOutput] = yield* applyOutputPlacementFx({
					origin: context.origin,
					output,
					runtime: draft,
				});
				draft = withOutput;
				const placementEvents = yield* readOutputPlacementItemEventsFx({
					originItemId: item.id,
					placement,
				});

				return {
					events: placementEvents,
					runtime: draft,
				};
			}),
		});
		draft = outputTransition.runtime;
		events.push(...outputTransition.events);
	}
	if (context.jobId !== undefined) {
		const jobTransition = yield* reconcileJobAfterTemporaryMaterialExpiryFx({
			jobId: context.jobId,
			runtime: draft,
		});
		draft = jobTransition.runtime;
		events.push(...jobTransition.events);
	}

	return {
		events,
		runtime: draft,
	} satisfies CompleteTemporaryItemExpiryTransitionResult;
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
		Effect.catchTag("ItemNotOnBoardError", (error) =>
			Effect.succeed({
				type: "blocked",
				error,
				runtime,
			} satisfies AttemptTemporaryItemExpiryResult),
		),
	);
});
