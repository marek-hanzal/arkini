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
import { resolveBoardPlacementOriginFx } from "./resolveBoardPlacementOriginFx";

export namespace planBoardPlacementFx {
	export interface Props {
		item: ItemSchema.Type;
		origin: PositionSchema.Type;
		placement: PlacementEnumSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Resolves one board origin, then plans canonical stack-first nearest placement. */
export const planBoardPlacementFx = Effect.fn("planBoardPlacementFx")(function* ({
	item,
	origin,
	placement,
	quantity,
	runtime,
}: planBoardPlacementFx.Props) {
	const config = yield* GameConfigFx;
	const placementOrigin = yield* resolveBoardPlacementOriginFx({
		origin,
		placement,
		size: config.meta.board,
	});
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
		origin: placementOrigin,
	});

	return yield* planScopePlacementFx({
		item,
		locations: orderedBoardLocations,
		origin: placementOrigin,
		quantity,
		runtime,
		scope: "board",
	});
});
