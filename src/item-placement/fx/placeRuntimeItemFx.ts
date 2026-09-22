import { Effect, Option } from "effect";

import { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { ItemStatefulError } from "~/game-runtime/error/ItemStatefulError";
import { isItemPureFn } from "~/game-runtime/fn/isItemPureFn";
import { assertOwnerIdleFx } from "~/production-job/fx/assertOwnerIdleFx";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { isSameGridLocationFn } from "~/item-location/fn/isSameGridLocationFn";
import { ItemJobScopedError } from "~/game-runtime/error/ItemJobScopedError";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import { orderGridLocationsFn } from "~/item-placement/fn/orderGridLocationsFn";
import { readBoardLocationsFn } from "~/item-placement/fn/readBoardLocationsFn";
import { readEmptyLocationsFn } from "~/item-placement/fn/readEmptyLocationsFn";
import { applyPlacementPlanFx } from "./applyPlacementPlanFx";
import { planDropPlacementFx } from "./planDropPlacementFx";

interface PlaceRuntimeItemProps {
	readonly excludedLocations?: ReadonlyArray<BoardLocationSchema.Type>;
	readonly itemId: IdSchema.Type;
	readonly origin: BoardLocationSchema.Type;
	readonly originItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

interface PlaceRuntimeItemResult {
	readonly events: readonly GameEventSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}

const excludeGridLocationsFn = <Location extends BoardLocationSchema.Type>({
	excludedLocations,
	locations,
}: {
	readonly excludedLocations?: ReadonlyArray<BoardLocationSchema.Type>;
	readonly locations: ReadonlyArray<Location>;
}) =>
	excludedLocations === undefined
		? locations
		: locations.filter(
				(location) =>
					!excludedLocations.some((excludedLocation) =>
						isSameGridLocationFn({
							left: location,
							right: excludedLocation,
						}),
					),
			);

const readRuntimeItemDropLocationFx = Effect.fn("readRuntimeItemDropLocationFx")(function* ({
	item,
	excludedLocations,
	origin,
	runtime,
}: {
	readonly item: RuntimeItemSchema.Type;
	readonly excludedLocations?: ReadonlyArray<BoardLocationSchema.Type>;
	readonly origin: BoardLocationSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const config = yield* GameConfigFx;
	const emptyBoard = readEmptyLocationsFn({
		locations: excludeGridLocationsFn({
			excludedLocations,
			locations: readBoardLocationsFn({
				size: config.meta.board,
				space: origin.space,
			}),
		}),
		runtime,
	});
	const orderedBoard = orderGridLocationsFn({
		locations: emptyBoard,
		origin: origin.position,
	});
	const location = orderedBoard[0];
	if (location !== undefined) return location;
	const reason = PlacementUnavailableError.Reason.BoardFull;
	return yield* Effect.fail(
		new PlacementUnavailableError({
			itemId: item.item.id,
			placement: PlacementSchema.enum.Drop,
			quantity: item.quantity,
			reason,
			remainingQuantity: item.quantity,
		}),
	);
});

/**
 * Returns one existing input-buffered or reserved item through the
 * canonical drop policy and reports the exact visible placement facts.
 */
export const placeRuntimeItemFx = Effect.fn("placeRuntimeItemFx")(function* ({
	excludedLocations,
	itemId,
	origin,
	originItemId,
	runtime,
}: PlaceRuntimeItemProps) {
	const item = yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
	if (item.location.scope === LocationScopeEnumSchema.enum.Job) {
		return yield* Effect.fail(
			new ItemJobScopedError({
				itemId: item.id,
				jobId: item.location.jobId,
			}),
		);
	}
	if (
		item.location.scope !== LocationScopeEnumSchema.enum.Input &&
		item.location.scope !== LocationScopeEnumSchema.enum.Reserved
	) {
		return yield* Effect.die(
			new Error(
				`Existing-item placement only accepts input or reserved items; ${item.id} is ${item.location.scope}.`,
			),
		);
	}
	{
		yield* assertOwnerIdleFx({
			ownerItemId: item.id,
			runtime,
		});
	}
	const pure = isItemPureFn({
		item,
		runtime,
	});
	const detachedRuntime = {
		...runtime,
		items: runtime.items.filter((candidate) => candidate.id !== item.id),
	} satisfies RuntimeSchema.Type;

	if (pure) {
		const plan = yield* planDropPlacementFx({
			drop: {
				itemId: item.item.id,
				placement: PlacementSchema.enum.Drop,
				quantity: item.quantity,
			},
			excludedLocations,
			origin,
			runtime: detachedRuntime,
		});
		const [placement, placedRuntime] = yield* applyPlacementPlanFx({
			plan,
			runtime: detachedRuntime,
		});
		const events: GameEventSchema.Type[] = [
			{
				type: "item:removed",
				snapshot: item,
			},
		];
		for (const stack of placement.stack) {
			const stackedItem = Option.getOrUndefined(narrowBoardRuntimeItemFn(stack.item));
			if (stackedItem === undefined) {
				return yield* Effect.die(
					new Error(
						`Existing-item placement stacked ${stack.item.id} outside a visible grid scope.`,
					),
				);
			}
			events.push({
				type: GameEventEnumSchema.enum.ItemStacked,
				itemId: stackedItem.id,
				canonicalItemId: stackedItem.item.id,
				originItemId,
				location: stackedItem.location,
				previousQuantity: stackedItem.quantity - stack.quantity,
				quantity: stackedItem.quantity,
			});
		}
		for (const runtimeSpawnedItem of placement.spawn) {
			const spawnedItem = Option.getOrUndefined(narrowBoardRuntimeItemFn(runtimeSpawnedItem));
			if (spawnedItem === undefined) {
				return yield* Effect.die(
					new Error(
						`Existing-item placement spawned ${runtimeSpawnedItem.id} outside a visible grid scope.`,
					),
				);
			}
			events.push({
				type: GameEventEnumSchema.enum.ItemSpawned,
				itemId: spawnedItem.id,
				canonicalItemId: spawnedItem.item.id,
				originItemId,
				location: spawnedItem.location,
				quantity: spawnedItem.quantity,
			});
		}
		return {
			events,
			runtime: placedRuntime,
		} satisfies PlaceRuntimeItemResult;
	}

	if (item.quantity !== 1) {
		return yield* Effect.fail(
			new ItemStatefulError({
				itemId: item.id,
			}),
		);
	}
	const location = yield* readRuntimeItemDropLocationFx({
		excludedLocations,
		item,
		origin,
		runtime: detachedRuntime,
	});
	const placedItem = yield* reviseRuntimeItemFx({
		item: {
			...item,
			location,
		} satisfies BoardRuntimeItemSchema.Type,
	});
	const placedRuntime = {
		...runtime,
		items: runtime.items.map((candidate) => {
			return candidate.id === item.id ? placedItem : candidate;
		}),
	} satisfies RuntimeSchema.Type;

	return {
		events: [
			{
				type: GameEventEnumSchema.enum.ItemPlaced,
				itemId: item.id,
				canonicalItemId: item.item.id,
				originItemId,
				previousLocation: item.location,
				location: placedItem.location,
				quantity: placedItem.quantity,
			},
		],
		runtime: placedRuntime,
	} satisfies PlaceRuntimeItemResult;
});
