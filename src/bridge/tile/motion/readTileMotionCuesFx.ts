import { Effect, Option } from "effect";
import { match } from "ts-pattern";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { readTileActorBadgeCountFx } from "~/bridge/tile/readTileActorBadgeCountFx";
import { readTileActorPrimaryAssetIdFx } from "~/bridge/tile/readTileActorPrimaryAssetIdFx";
import { readTileActorVisualFx } from "~/bridge/tile/readTileActorVisualFx";
import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import { readGridRuntimeItemFx } from "~/bridge/tile/motion/readGridRuntimeItemFx";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { isSameGridLocationFx } from "~/engine/location/read/isSameGridLocationFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { readRuntimeInventoryOpenerFx } from "~/engine/runtime/read/readRuntimeInventoryOpenerFx";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
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
					readonly kind: "input";
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

export namespace readTileMotionCuesFx {
	export interface Props {
		readonly game: GameEngine;
		readonly transition: CommittedTransitionSchema.Type;
	}
}

const readOriginLocationFx = Effect.fn("readTileMotionCueOriginLocationFx")(function* ({
	originItemId,
	transition,
}: {
	readonly originItemId: string;
	readonly transition: CommittedTransitionSchema.Type;
}) {
	const previous = yield* readGridRuntimeItemFx({
		itemId: originItemId,
		runtime: transition.previousRuntime,
	});
	if (previous !== null) return previous.location;
	const current = yield* readGridRuntimeItemFx({
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
	const target = yield* readGridRuntimeItemFx({
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

const readInventoryInputSourceItemFx = Effect.fn("readInventoryInputSourceItemFx")(function* ({
	game,
	runtime,
	source,
}: {
	readonly game: GameEngine;
	readonly runtime: RuntimeSchema.Type;
	readonly source: GridRuntimeItemSchema.Type;
}) {
	const visual = yield* readTileActorVisualFx({
		game,
		item: source.item,
		primaryAssetId: yield* readTileActorPrimaryAssetIdFx({
			item: source,
			runtime,
		}),
	});
	const badgeCount = yield* readTileActorBadgeCountFx(source);
	return {
		...visual,
		...(badgeCount === undefined
			? {}
			: {
					badgeCount,
				}),
		id: source.id,
		itemType: source.item.type,
		location: source.location,
		primaryAction: {
			kind: "none",
		},
		quantity: source.quantity,
		revision: source.revision,
		running: false,
		activityEffect: false,
	} satisfies TileActorItem;
});

const readEventCueFx = Effect.fn("readTileMotionEventCueFx")(function* ({
	event,
	eventIndex,
	game,
	transition,
}: {
	readonly event: GameEventSchema.Type;
	readonly eventIndex: number;
	readonly game: GameEngine;
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
				type: GameEventEnumSchema.enum.ItemInputStored,
				previousSourceLocation: {
					scope: LocationScopeEnumSchema.enum.Board,
				},
			},
			(stored) =>
				readGridRuntimeItemFx({
					itemId: stored.ownerItemId,
					runtime: transition.runtime,
				}).pipe(
					Effect.map((target) =>
						target === null
							? null
							: ({
									kind: "input",
									sequence: transition.sequence,
									eventIndex,
									sourceActorId: stored.sourceItemId,
									targetActorId: stored.ownerItemId,
									canonicalItemId: stored.canonicalItemId,
									previousQuantity: stored.previousQuantity,
									storedQuantity: stored.storedQuantity,
									resultingQuantity: stored.resultingQuantity,
									originActorId: stored.sourceItemId,
									originLocation: stored.previousSourceLocation,
									targetLocation: target.location,
								} satisfies UnstaggeredTileMotionCue),
					),
				),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemInputStored,
				previousSourceLocation: {
					scope: LocationScopeEnumSchema.enum.Inventory,
				},
			},
			(stored) =>
				Effect.gen(function* () {
					if (transition.previousRuntime === null) return null;
					const source = yield* readGridRuntimeItemFx({
						itemId: stored.sourceItemId,
						runtime: transition.previousRuntime,
					});
					if (
						source === null ||
						source.item.id !== stored.canonicalItemId ||
						!(yield* isSameGridLocationFx({
							left: source.location,
							right: stored.previousSourceLocation,
						}))
					) {
						return null;
					}
					const [inventoryOpener, target] = yield* Effect.all([
						readRuntimeInventoryOpenerFx({
							itemId: source.id,
							runtime: transition.previousRuntime,
						}).pipe(Effect.option),
						readGridRuntimeItemFx({
							itemId: stored.ownerItemId,
							runtime: transition.runtime,
						}),
					]);
					if (Option.isNone(inventoryOpener) || target === null) return null;
					return {
						kind: "input",
						sequence: transition.sequence,
						eventIndex,
						sourceActorId: stored.sourceItemId,
						sourceItem: yield* readInventoryInputSourceItemFx({
							game,
							runtime: transition.previousRuntime,
							source,
						}),
						targetActorId: stored.ownerItemId,
						canonicalItemId: stored.canonicalItemId,
						previousQuantity: stored.previousQuantity,
						storedQuantity: stored.storedQuantity,
						resultingQuantity: stored.resultingQuantity,
						originActorId: inventoryOpener.value.id,
						originLocation: inventoryOpener.value.location,
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
				Effect.gen(function* () {
					const [originLocation, target] = yield* Effect.all([
						readOriginLocationFx({
							originItemId: placed.originItemId,
							transition,
						}),
						readTargetFx({
							canonicalItemId: placed.canonicalItemId,
							itemId: placed.itemId,
							location: placed.location,
							runtime: transition.runtime,
						}),
					]);
					if (originLocation === null || target === null) return null;
					return {
						kind: "spawn",
						sequence: transition.sequence,
						eventIndex,
						actorId: target.id,
						originActorId: placed.originItemId,
						originLocation,
						targetLocation: target.location,
					} satisfies UnstaggeredTileMotionCue;
				}),
		)
		.otherwise(() => Effect.succeed(null));
});

/**
 * Compiles ordered engine facts into semantic tile motion intents.
 *
 * Missing or stale visual identities intentionally degrade to no cue; gameplay has already
 * committed and renderer choreography must never weaken that authority.
 */
export const readTileMotionCuesFx = Effect.fn("readTileMotionCuesFx")(function* ({
	game,
	transition,
}: readTileMotionCuesFx.Props) {
	const cues = yield* Effect.forEach(transition.events, (event, eventIndex) =>
		readEventCueFx({
			event,
			eventIndex,
			game,
			transition,
		}),
	);
	const unstaggered: ReadonlyArray<UnstaggeredTileMotionCue> = cues.filter((cue) => cue !== null);
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
