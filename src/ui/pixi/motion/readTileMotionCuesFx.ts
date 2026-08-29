import { Effect, Option } from "effect";

import type { GameEngine } from "~/renderer/game/GameEngine";
import type { TileActorItem } from "~/ui/pixi/actor/TileActorItem";
import { readTileActorBadgeCountFn } from "~/ui/pixi/actor/fn/readTileActorBadgeCountFn";
import { readTileActorAssetSourceIdsFx } from "~/ui/pixi/actor/readTileActorAssetSourceIdsFx";
import { readTileActorVisualFx } from "~/ui/pixi/actor/readTileActorVisualFx";
import type { TileMotionCue } from "~/ui/pixi/motion/TileMotionCue";
import { readGridRuntimeItemFn } from "~/ui/pixi/motion/fn/readGridRuntimeItemFn";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { isSameGridLocationFn } from "~/engine/location/fn/isSameGridLocationFn";
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

const readOriginLocation = ({
	originItemId,
	transition,
}: {
	readonly originItemId: string;
	readonly transition: CommittedTransitionSchema.Type;
}) => {
	const previous = readGridRuntimeItemFn({
		itemId: originItemId,
		runtime: transition.previousRuntime,
	});
	if (previous !== null) return previous.location;
	const current = readGridRuntimeItemFn({
		itemId: originItemId,
		runtime: transition.runtime,
	});
	return current?.location ?? null;
};

const readTarget = ({
	canonicalItemId,
	itemId,
	location,
	runtime,
}: {
	readonly canonicalItemId: string;
	readonly itemId: string;
	readonly location: GridLocationSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) => {
	const target = readGridRuntimeItemFn({
		itemId,
		runtime,
	});
	if (
		target === null ||
		target.item.id !== canonicalItemId ||
		!isSameGridLocationFn({
			left: target.location,
			right: location,
		})
	) {
		return null;
	}
	return target;
};

type SpawnMotionEvent = Pick<
	Extract<
		GameEventSchema.Type,
		{
			readonly type: typeof GameEventEnumSchema.enum.ItemSpawned;
		}
	>,
	"canonicalItemId" | "itemId" | "location" | "originItemId"
>;

const readSpawnCue = ({
	event,
	eventIndex,
	transition,
}: {
	readonly event: SpawnMotionEvent;
	readonly eventIndex: number;
	readonly transition: CommittedTransitionSchema.Type;
}) => {
	const originLocation = readOriginLocation({
		originItemId: event.originItemId,
		transition,
	});
	const target = readTarget({
		canonicalItemId: event.canonicalItemId,
		itemId: event.itemId,
		location: event.location,
		runtime: transition.runtime,
	});
	if (originLocation === null || target === null) return null;
	return {
		kind: "spawn",
		sequence: transition.sequence,
		eventIndex,
		actorId: target.id,
		originActorId: event.originItemId,
		originLocation,
		targetLocation: target.location,
	} satisfies UnstaggeredTileMotionCue;
};

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
		sourceIds: yield* readTileActorAssetSourceIdsFx({
			item: source,
			runtime,
		}),
	});
	const badgeCount = readTileActorBadgeCountFn(source);
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
	if (event.type === GameEventEnumSchema.enum.ItemSpawned) {
		return readSpawnCue({
			event,
			eventIndex,
			transition,
		});
	}
	if (event.type === GameEventEnumSchema.enum.ItemStacked) {
		const originLocation = readOriginLocation({
			originItemId: event.originItemId,
			transition,
		});
		const target = readTarget({
			canonicalItemId: event.canonicalItemId,
			itemId: event.itemId,
			location: event.location,
			runtime: transition.runtime,
		});
		if (originLocation === null || target === null) return null;
		return {
			kind: "stack",
			sequence: transition.sequence,
			eventIndex,
			targetActorId: target.id,
			canonicalItemId: event.canonicalItemId,
			quantity: event.quantity - event.previousQuantity,
			originActorId: event.originItemId,
			originLocation,
			targetLocation: target.location,
		} satisfies UnstaggeredTileMotionCue;
	}
	if (
		event.type === GameEventEnumSchema.enum.ItemInputStored &&
		event.previousSourceLocation.scope === LocationScopeEnumSchema.enum.Board
	) {
		const target = readGridRuntimeItemFn({
			itemId: event.ownerItemId,
			runtime: transition.runtime,
		});
		if (target === null) return null;
		return {
			kind: "input",
			sequence: transition.sequence,
			eventIndex,
			sourceActorId: event.sourceItemId,
			targetActorId: event.ownerItemId,
			canonicalItemId: event.canonicalItemId,
			previousQuantity: event.previousQuantity,
			storedQuantity: event.storedQuantity,
			resultingQuantity: event.resultingQuantity,
			originActorId: event.sourceItemId,
			originLocation: event.previousSourceLocation,
			targetLocation: target.location,
		} satisfies UnstaggeredTileMotionCue;
	}
	if (
		event.type === GameEventEnumSchema.enum.ItemInputStored &&
		event.previousSourceLocation.scope === LocationScopeEnumSchema.enum.Inventory
	) {
		if (transition.previousRuntime === null) return null;
		const source = readGridRuntimeItemFn({
			itemId: event.sourceItemId,
			runtime: transition.previousRuntime,
		});
		if (
			source === null ||
			source.item.id !== event.canonicalItemId ||
			!isSameGridLocationFn({
				left: source.location,
				right: event.previousSourceLocation,
			})
		) {
			return null;
		}
		const inventoryOpener = yield* readRuntimeInventoryOpenerFx({
			itemId: source.id,
			runtime: transition.previousRuntime,
		}).pipe(Effect.option);
		const target = readGridRuntimeItemFn({
			itemId: event.ownerItemId,
			runtime: transition.runtime,
		});
		if (Option.isNone(inventoryOpener) || target === null) return null;
		return {
			kind: "input",
			sequence: transition.sequence,
			eventIndex,
			sourceActorId: event.sourceItemId,
			sourceItem: yield* readInventoryInputSourceItemFx({
				game,
				runtime: transition.previousRuntime,
				source,
			}),
			targetActorId: event.ownerItemId,
			canonicalItemId: event.canonicalItemId,
			previousQuantity: event.previousQuantity,
			storedQuantity: event.storedQuantity,
			resultingQuantity: event.resultingQuantity,
			originActorId: inventoryOpener.value.id,
			originLocation: inventoryOpener.value.location,
			targetLocation: target.location,
		} satisfies UnstaggeredTileMotionCue;
	}
	if (
		event.type === GameEventEnumSchema.enum.ItemPlaced &&
		event.previousLocation.scope === LocationScopeEnumSchema.enum.Inventory
	) {
		return readSpawnCue({
			event,
			eventIndex,
			transition,
		});
	}
	return null;
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
	const nextIndexByBatch = new Map<string, number>();
	return unstaggered.map((cue): TileMotionCue => {
		const batchKey = `${cue.sequence}:${cue.originActorId}`;
		const staggerIndex = nextIndexByBatch.get(batchKey) ?? 0;
		nextIndexByBatch.set(batchKey, staggerIndex + 1);
		return {
			...cue,
			staggerIndex,
		};
	});
});
