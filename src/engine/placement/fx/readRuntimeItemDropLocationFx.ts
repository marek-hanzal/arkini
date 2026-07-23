import { Effect } from "effect";
import { match } from "ts-pattern";

import { PlacementEnumSchema } from "~/engine/placement/schema/PlacementEnumSchema";
import { PlacementFailureReasonEnumSchema } from "~/engine/placement/schema/PlacementFailureReasonEnumSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";

import { orderBoardLocationsFx } from "./orderBoardLocationsFx";
import { readEmptyLocationsFx } from "./readEmptyLocationsFx";
import { readBoardLocationsFx } from "./readBoardLocationsFx";
import { readInventoryLocationsFx } from "./readInventoryLocationsFx";
import { readToolbarLocationsFx } from "./readToolbarLocationsFx";

export namespace readRuntimeItemDropLocationFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
		origin: BoardLocationSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Resolves one exclusive grid cell through the canonical drop scope and ordering policy. */
export const readRuntimeItemDropLocationFx = Effect.fn("readRuntimeItemDropLocationFx")(function* ({
	item,
	origin,
	runtime,
}: readRuntimeItemDropLocationFx.Props) {
	const config = yield* GameConfigFx;
	const board = yield* readBoardLocationsFx({
		size: config.meta.board,
		space: origin.space,
	});
	const orderedBoard = yield* orderBoardLocationsFx({
		locations: yield* readEmptyLocationsFx({
			locations: board,
			runtime,
		}),
		origin: origin.position,
	});
	const inventory = yield* readInventoryLocationsFx({
		size: config.meta.inventory,
	});
	const emptyInventory = yield* readEmptyLocationsFx({
		locations: inventory,
		runtime,
	});
	const toolbar = yield* readToolbarLocationsFx({
		size: config.meta.toolbarSize ?? 0,
	});
	const emptyToolbar = yield* readEmptyLocationsFx({
		locations: toolbar,
		runtime,
	});

	const location = match(item.item.scope)
		.with(StorageScopeEnumSchema.enum.Board, () => orderedBoard[0])
		.with(StorageScopeEnumSchema.enum.Inventory, () => emptyInventory[0])
		.with(StorageScopeEnumSchema.enum.Toolbar, () => emptyToolbar[0])
		.with(
			StorageScopeEnumSchema.enum.Any,
			() => orderedBoard[0] ?? emptyInventory[0] ?? emptyToolbar[0],
		)
		.exhaustive() satisfies GridLocationSchema.Type | undefined;
	if (location !== undefined) return location;

	const reason =
		item.item.scope === StorageScopeEnumSchema.enum.Board
			? PlacementFailureReasonEnumSchema.enum.BoardFull
			: item.item.scope === StorageScopeEnumSchema.enum.Toolbar
				? PlacementFailureReasonEnumSchema.enum.ToolbarFull
				: PlacementFailureReasonEnumSchema.enum.InventoryFull;
	return yield* Effect.fail(
		new PlacementUnavailableError({
			itemId: item.item.id,
			placement: PlacementEnumSchema.enum.Drop,
			quantity: item.quantity,
			reason,
			remainingQuantity: item.quantity,
		}),
	);
});
