import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { PlacementEnumSchema } from "~/v1/placement/schema/PlacementEnumSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { orderBoardLocationsFx } from "./orderBoardLocationsFx";
import { planScopePlacementFx } from "./planScopePlacementFx";
import { readEmptyLocationsFx } from "./readEmptyLocationsFx";
import { readGridLocationsFx } from "./readGridLocationsFx";

export namespace planBoardPlacementFx {
	export interface Props {
		item: ItemSchema.Type;
		origin: PositionSchema.Type;
		placement: Exclude<PlacementEnumSchema.Type, "replace">;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Plans stack-first board placement using one concrete board ordering strategy.
 */
export const planBoardPlacementFx = Effect.fn("planBoardPlacementFx")(function* ({
	item,
	origin,
	placement,
	quantity,
	runtime,
}: planBoardPlacementFx.Props) {
	const config = yield* GameConfigFx;
	const boardLocations = yield* readGridLocationsFx({
		scope: "board",
		size: config.meta.board,
	});
	const emptyBoardLocations = yield* readEmptyLocationsFx({
		locations: boardLocations,
		runtime,
	});
	const orderedBoardLocations = yield* orderBoardLocationsFx({
		locations: emptyBoardLocations,
		origin,
		placement,
	});

	return yield* planScopePlacementFx({
		item,
		locations: orderedBoardLocations,
		origin: placement === "drop" ? origin : undefined,
		quantity,
		runtime,
		scope: "board",
	});
});
