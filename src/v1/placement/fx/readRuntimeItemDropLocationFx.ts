import { Effect } from "effect";
import { match } from "ts-pattern";

import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import { PlacementUnavailableError } from "~/v1/placement/error/PlacementUnavailableError";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { orderBoardLocationsFx } from "./orderBoardLocationsFx";
import { readEmptyLocationsFx } from "./readEmptyLocationsFx";
import { readGridLocationsFx } from "./readGridLocationsFx";

export namespace readRuntimeItemDropLocationFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
		origin: PositionSchema.Type;
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
	const board = yield* readGridLocationsFx({
		scope: "board",
		size: config.meta.board,
	});
	const orderedBoard = yield* orderBoardLocationsFx({
		locations: yield* readEmptyLocationsFx({
			locations: board,
			runtime,
		}),
		origin,
	});
	const inventory = yield* readGridLocationsFx({
		scope: "inventory",
		size: config.meta.inventory,
	});
	const emptyInventory = yield* readEmptyLocationsFx({
		locations: inventory,
		runtime,
	});

	const location = match(item.item.scope)
		.with("board", () => orderedBoard[0])
		.with("inventory", () => emptyInventory[0])
		.with("any", () => orderedBoard[0] ?? emptyInventory[0])
		.exhaustive() satisfies GridLocationSchema.Type | undefined;
	if (location !== undefined) return location;

	const reason = item.item.scope === "board" ? "board:full" : "inventory:full";
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
