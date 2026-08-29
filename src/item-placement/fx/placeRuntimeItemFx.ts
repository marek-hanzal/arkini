import { Effect, Option } from "effect";
import { match } from "ts-pattern";

import { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { ItemStatefulError } from "~/engine/item/error/ItemStatefulError";
import { isItemPureFn } from "~/engine/item/fn/isItemPureFn";
import { assertOwnerIdleFx } from "~/production-job/fx/assertOwnerIdleFx";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { ItemJobScopedError } from "~/engine/runtime/error/ItemJobScopedError";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import { isGridRuntimeItemFn } from "~/engine/runtime/read/fn/isGridRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { StorageSchema } from "~/item-definition/schema/StorageSchema";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import { orderGridLocationsFn } from "~/item-placement/fn/orderGridLocationsFn";
import { readBoardLocationsFn } from "~/item-placement/fn/readBoardLocationsFn";
import { readEmptyLocationsFn } from "~/item-placement/fn/readEmptyLocationsFn";
import { readInventoryLocationsFn } from "~/item-placement/fn/readInventoryLocationsFn";
import { readToolbarLocationsFn } from "~/item-placement/fn/readToolbarLocationsFn";
import { applyPlacementPlanFx } from "./applyPlacementPlanFx";
import { planDropPlacementFx } from "./planDropPlacementFx";

interface PlaceRuntimeItemProps {
	readonly itemId: IdSchema.Type;
	readonly origin: BoardLocationSchema.Type;
	readonly originItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

interface PlaceRuntimeItemResult {
	readonly events: readonly GameEventSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}

const readRuntimeItemDropLocationFx = Effect.fn("readRuntimeItemDropLocationFx")(function* ({
	item,
	origin,
	runtime,
}: {
	readonly item: RuntimeItemSchema.Type;
	readonly origin: BoardLocationSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const config = yield* GameConfigFx;
	const board = readBoardLocationsFn({
		size: config.meta.board,
		space: origin.space,
	});
	const orderedBoard = orderGridLocationsFn({
		locations: readEmptyLocationsFn({
			locations: board,
			runtime,
		}),
		origin: origin.position,
	});
	const inventory = readInventoryLocationsFn({
		size: config.meta.inventory,
	});
	const emptyInventory = readEmptyLocationsFn({
		locations: inventory,
		runtime,
	});
	const toolbar = readToolbarLocationsFn({
		size: config.meta.toolbarSize ?? 0,
	});
	const emptyToolbar = readEmptyLocationsFn({
		locations: toolbar,
		runtime,
	});

	const location = match(item.item.scope)
		.with(StorageSchema.enum.Board, () => orderedBoard[0])
		.with(StorageSchema.enum.Inventory, () => emptyInventory[0])
		.with(StorageSchema.enum.Toolbar, () => emptyToolbar[0])
		.with(StorageSchema.enum.Any, () => orderedBoard[0] ?? emptyInventory[0] ?? emptyToolbar[0])
		.exhaustive() satisfies GridLocationSchema.Type | undefined;
	if (location !== undefined) return location;

	const reason =
		item.item.scope === StorageSchema.enum.Board
			? PlacementUnavailableError.Reason.BoardFull
			: item.item.scope === StorageSchema.enum.Toolbar
				? PlacementUnavailableError.Reason.ToolbarFull
				: PlacementUnavailableError.Reason.InventoryFull;
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
			origin,
			runtime: detachedRuntime,
		});
		const [placement, placedRuntime] = yield* applyPlacementPlanFx({
			plan,
			runtime: detachedRuntime,
		});
		const events: GameEventSchema.Type[] = [];
		for (const stack of placement.stack) {
			const stackedItem = Option.getOrUndefined(isGridRuntimeItemFn(stack.item));
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
			const spawnedItem = Option.getOrUndefined(isGridRuntimeItemFn(runtimeSpawnedItem));
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
