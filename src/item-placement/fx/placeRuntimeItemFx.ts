import { Effect, Option } from "effect";

import { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { ItemStatefulError } from "~/game-runtime/error/ItemStatefulError";
import { isItemPureFn } from "~/game-runtime/fn/isItemPureFn";
import { assertOwnerIdleFx } from "~/production-job/fx/assertOwnerIdleFx";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { isSameGridLocationFn } from "~/item-location/fn/isSameGridLocationFn";
import { ItemJobScopedError } from "~/game-runtime/error/ItemJobScopedError";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { narrowGridRuntimeItemFn } from "~/game-runtime/fn/narrowGridRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { GridRuntimeItemSchema } from "~/game-runtime/schema/GridRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import { orderGridLocationsFn } from "~/item-placement/fn/orderGridLocationsFn";
import { readBoardLocationsFn } from "~/item-placement/fn/readBoardLocationsFn";
import { readEmptyLocationsFn } from "~/item-placement/fn/readEmptyLocationsFn";
import { readInventoryLocationsFn } from "~/item-placement/fn/readInventoryLocationsFn";
import { readPlacementRouteFn } from "~/item-placement/fn/readPlacementRouteFn";
import { readToolbarLocationsFn } from "~/item-placement/fn/readToolbarLocationsFn";
import { applyPlacementPlanFx } from "./applyPlacementPlanFx";
import { planDropPlacementFx } from "./planDropPlacementFx";

interface PlaceRuntimeItemProps {
	readonly excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
	readonly itemId: IdSchema.Type;
	readonly origin: GridLocationSchema.Type;
	readonly originItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

interface PlaceRuntimeItemResult {
	readonly events: readonly GameEventSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}

const excludeGridLocationsFn = <Location extends GridLocationSchema.Type>({
	excludedLocations,
	locations,
}: {
	readonly excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
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
	readonly excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
	readonly origin: GridLocationSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const config = yield* GameConfigFx;
	const emptyBoard = readEmptyLocationsFn({
		locations: excludeGridLocationsFn({
			excludedLocations,
			locations: readBoardLocationsFn({
				size: config.meta.board,
				space:
					origin.scope === LocationScopeEnumSchema.enum.Board
						? origin.space
						: runtime.currentSpace,
			}),
		}),
		runtime,
	});
	const orderedBoard =
		origin.scope === LocationScopeEnumSchema.enum.Board
			? orderGridLocationsFn({
					locations: emptyBoard,
					origin: origin.position,
				})
			: emptyBoard;
	const inventory = excludeGridLocationsFn({
		excludedLocations,
		locations: readInventoryLocationsFn({
			size: config.meta.inventory,
		}),
	});
	const emptyInventory = readEmptyLocationsFn({
		locations: inventory,
		runtime,
	});
	const orderedInventory =
		origin.scope === LocationScopeEnumSchema.enum.Inventory
			? orderGridLocationsFn({
					locations: emptyInventory,
					origin: origin.position,
				})
			: emptyInventory;
	const toolbar = excludeGridLocationsFn({
		excludedLocations,
		locations: readToolbarLocationsFn({
			size: config.meta.toolbarSize ?? 0,
		}),
	});
	const emptyToolbar = readEmptyLocationsFn({
		locations: toolbar,
		runtime,
	});
	const orderedToolbar =
		origin.scope === LocationScopeEnumSchema.enum.Toolbar
			? orderGridLocationsFn({
					locations: emptyToolbar,
					origin: origin.position,
				})
			: emptyToolbar;

	const locationsByScope = {
		board: orderedBoard,
		inventory: orderedInventory,
		toolbar: orderedToolbar,
	} satisfies Record<readPlacementRouteFn.Scope, ReadonlyArray<GridLocationSchema.Type>>;
	const route = readPlacementRouteFn({
		itemScope: item.item.scope,
		originScope: origin.scope,
		toolbarEnabled: (config.meta.toolbarSize ?? 0) > 0,
	});
	for (const step of route) {
		const location = locationsByScope[step.scope][0];
		if (location !== undefined) return location;
	}

	const reason = route[route.length - 1].unavailableReason;
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
 * Returns one existing input-buffered, reserved, or Inventory item through the
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
		item.location.scope !== LocationScopeEnumSchema.enum.Reserved &&
		item.location.scope !== LocationScopeEnumSchema.enum.Inventory
	) {
		return yield* Effect.die(
			new Error(
				`Existing-item placement only accepts input, reserved, or Inventory items; ${item.id} is ${item.location.scope}.`,
			),
		);
	}
	if (item.location.scope !== LocationScopeEnumSchema.enum.Inventory) {
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
		const events: GameEventSchema.Type[] = [];
		for (const stack of placement.stack) {
			const stackedItem = Option.getOrUndefined(narrowGridRuntimeItemFn(stack.item));
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
			const spawnedItem = Option.getOrUndefined(narrowGridRuntimeItemFn(runtimeSpawnedItem));
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
		} satisfies GridRuntimeItemSchema.Type,
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
