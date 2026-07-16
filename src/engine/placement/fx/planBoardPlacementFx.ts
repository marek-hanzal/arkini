import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { PlacementEnumSchema } from "~/engine/placement/schema/PlacementEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { orderBoardLocationsFx } from "./orderBoardLocationsFx";
import { planScopePlacementFx } from "./planScopePlacementFx";
import { readBoardLocationsFx } from "./readBoardLocationsFx";
import { resolveBoardPlacementOriginFx } from "./resolveBoardPlacementOriginFx";

export namespace planBoardPlacementFx {
	export interface Props {
		item: ItemSchema.Type;
		origin: BoardLocationSchema.Type;
		placement: PlacementEnumSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Resolves one board-space origin, then plans stack-first nearest placement there. */
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
	const boardLocations = yield* readBoardLocationsFx({
		size: config.meta.board,
		space: origin.space,
	});
	const orderedBoardLocations = yield* orderBoardLocationsFx({
		locations: boardLocations,
		origin: placementOrigin.position,
	});

	return yield* planScopePlacementFx({
		item,
		locations: orderedBoardLocations,
		origin: placementOrigin.position,
		quantity,
		runtime,
	});
});
