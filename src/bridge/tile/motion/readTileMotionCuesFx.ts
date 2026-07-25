import { Effect, Option } from "effect";
import { match } from "ts-pattern";

import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { isSameGridLocationFx } from "~/engine/location/read/isSameGridLocationFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import type { CommittedTransitionSchema } from "~/engine/runtime/schema/CommittedTransitionSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

type UnstaggeredTileMotionCue =
	| Omit<
			Extract<
				TileMotionCue,
				{
					readonly kind: "spawn";
				}
			>,
			"staggerIndex"
	  >
	| Omit<
			Extract<
				TileMotionCue,
				{
					readonly kind: "stack";
				}
			>,
			"staggerIndex"
	  >;

const readGridItemFx = Effect.fn("readTileMotionCueGridItemFx")(function* ({
	itemId,
	runtime,
}: {
	readonly itemId: string;
	readonly runtime: RuntimeSchema.Type | null;
}) {
	if (runtime === null) return null;
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined) return null;
	return Option.getOrNull(yield* isGridRuntimeItemFx(item));
});

const readOriginLocationFx = Effect.fn("readTileMotionCueOriginLocationFx")(function* ({
	originItemId,
	transition,
}: {
	readonly originItemId: string;
	readonly transition: CommittedTransitionSchema.Type;
}) {
	const previous = yield* readGridItemFx({
		itemId: originItemId,
		runtime: transition.previousRuntime,
	});
	if (previous !== null) return previous.location;
	const current = yield* readGridItemFx({
		itemId: originItemId,
		runtime: transition.runtime,
	});
	return current?.location ?? null;
});

const readTargetFx = Effect.fn("readTileMotionCueTargetFx")(function* ({
	canonicalItemId,
	itemId,
	location,
	runtime,
}: {
	readonly canonicalItemId: string;
	readonly itemId: string;
	readonly location: GridLocationSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const target = yield* readGridItemFx({
		itemId,
		runtime,
	});
	if (
		target === null ||
		target.item.id !== canonicalItemId ||
		!(yield* isSameGridLocationFx({
			left: target.location,
			right: location,
		}))
	) {
		return null;
	}
	return target;
});

const readEventCueFx = Effect.fn("readTileMotionEventCueFx")(function* ({
	event,
	eventIndex,
	transition,
}: {
	readonly event: GameEventSchema.Type;
	readonly eventIndex: number;
	readonly transition: CommittedTransitionSchema.Type;
}) {
	return yield* match(event)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemSpawned,
			},
			(spawned) =>
				Effect.gen(function* () {
					const [originLocation, target] = yield* Effect.all([
						readOriginLocationFx({
							originItemId: spawned.originItemId,
							transition,
						}),
						readTargetFx({
							canonicalItemId: spawned.canonicalItemId,
							itemId: spawned.itemId,
							location: spawned.location,
							runtime: transition.runtime,
						}),
					]);
					if (originLocation === null || target === null) return null;
					return {
						kind: "spawn",
						sequence: transition.sequence,
						eventIndex,
						actorId: target.id,
						originActorId: spawned.originItemId,
						originLocation,
						targetLocation: target.location,
					} satisfies UnstaggeredTileMotionCue;
				}),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemStacked,
			},
			(stacked) =>
				Effect.gen(function* () {
					const [originLocation, target] = yield* Effect.all([
						readOriginLocationFx({
							originItemId: stacked.originItemId,
							transition,
						}),
						readTargetFx({
							canonicalItemId: stacked.canonicalItemId,
							itemId: stacked.itemId,
							location: stacked.location,
							runtime: transition.runtime,
						}),
					]);
					if (originLocation === null || target === null) return null;
					return {
						kind: "stack",
						sequence: transition.sequence,
						eventIndex,
						targetActorId: target.id,
						canonicalItemId: stacked.canonicalItemId,
						quantity: stacked.quantity - stacked.previousQuantity,
						originActorId: stacked.originItemId,
						originLocation,
						targetLocation: target.location,
					} satisfies UnstaggeredTileMotionCue;
				}),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemPlaced,
				previousLocation: {
					scope: LocationScopeEnumSchema.enum.Inventory,
				},
			},
			(placed) =>
				readTargetFx({
					canonicalItemId: placed.canonicalItemId,
					itemId: placed.itemId,
					location: placed.location,
					runtime: transition.runtime,
				}).pipe(
					Effect.map((target) =>
						target === null
							? null
							: ({
									kind: "spawn",
									sequence: transition.sequence,
									eventIndex,
									actorId: target.id,
									originActorId: placed.originItemId,
									originLocation: placed.previousLocation,
									targetLocation: target.location,
								} satisfies UnstaggeredTileMotionCue),
					),
				),
		)
		.otherwise(() => Effect.succeed(null));
});

/**
 * Compiles ordered engine facts into semantic tile motion intents.
 *
 * Missing or stale visual identities intentionally degrade to no cue; gameplay has already
 * committed and renderer choreography must never weaken that authority.
 */
export const readTileMotionCuesFx = Effect.fn("readTileMotionCuesFx")(function* (
	transition: CommittedTransitionSchema.Type,
) {
	const cues = yield* Effect.forEach(transition.events, (event, eventIndex) =>
		readEventCueFx({
			event,
			eventIndex,
			transition,
		}),
	);
	const unstaggered = cues.filter((cue): cue is UnstaggeredTileMotionCue => cue !== null);
	const staggered = yield* Effect.reduce(
		unstaggered,
		() => ({
			cues: [] as ReadonlyArray<TileMotionCue>,
			nextIndexByBatch: new Map<string, number>(),
		}),
		(current, cue) =>
			Effect.sync(() => {
				const batchKey = `${cue.sequence}:${cue.originActorId}`;
				const staggerIndex = current.nextIndexByBatch.get(batchKey) ?? 0;
				return {
					cues: [
						...current.cues,
						{
							...cue,
							staggerIndex,
						},
					],
					nextIndexByBatch: new Map([
						...current.nextIndexByBatch,
						[
							batchKey,
							staggerIndex + 1,
						],
					]),
				};
			}),
	);
	return staggered.cues;
});
