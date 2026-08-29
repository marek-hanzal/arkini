import { Effect } from "effect";
import { match } from "ts-pattern";

import { PlacementSchema } from "~/engine/placement/schema/PlacementSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import { orderGridLocationsFn } from "~/engine/placement/fn/orderGridLocationsFn";
import { readBoardLocationsFn } from "~/engine/placement/fn/readBoardLocationsFn";
import { readEmptyLocationsFn } from "~/engine/placement/fn/readEmptyLocationsFn";
import { readInventoryLocationsFn } from "~/engine/placement/fn/readInventoryLocationsFn";
import { readToolbarLocationsFn } from "~/engine/placement/fn/readToolbarLocationsFn";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { StorageSchema } from "~/engine/scope/schema/StorageSchema";

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
