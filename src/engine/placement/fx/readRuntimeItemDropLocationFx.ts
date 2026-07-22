import { Effect } from "effect";
import { match } from "ts-pattern";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { orderBoardLocationsFx } from "./orderBoardLocationsFx";
import { readEmptyLocationsFx } from "./readEmptyLocationsFx";
import { readBoardLocationsFx } from "./readBoardLocationsFx";
import { readInventoryLocationsFx } from "./readInventoryLocationsFx";
import { readToolbarLocationsFx } from "./readToolbarLocationsFx";
import { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";

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
		.with(StorageScopeEnumSchema.enum.board, () => orderedBoard[0])
		.with(StorageScopeEnumSchema.enum.inventory, () => emptyInventory[0])
		.with(StorageScopeEnumSchema.enum.toolbar, () => emptyToolbar[0])
		.with(StorageScopeEnumSchema.enum.any, () => orderedBoard[0] ?? emptyInventory[0] ?? emptyToolbar[0])
		.exhaustive() satisfies GridLocationSchema.Type | undefined;
	if (location !== undefined) return location;

	const reason =
		item.item.scope === StorageScopeEnumSchema.enum.board
			? "board:full"
			: item.item.scope === StorageScopeEnumSchema.enum.toolbar
				? "toolbar:full"
				: "inventory:full";
	return yield* Effect.fail(
		new PlacementUnavailableError({
			itemId: item.item.id,
			placement: "drop",
			quantity: item.quantity,
			reason,
			remainingQuantity: item.quantity,
		}),
	);
});
