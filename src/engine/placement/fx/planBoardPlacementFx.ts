import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { orderGridLocationsFn } from "~/engine/placement/fn/orderGridLocationsFn";
import { readBoardLocationsFn } from "~/engine/placement/fn/readBoardLocationsFn";
import type { PlacementSchema } from "~/engine/placement/schema/PlacementSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { planScopePlacementFx } from "./planScopePlacementFx";
import { resolveBoardPlacementOriginFx } from "./resolveBoardPlacementOriginFx";

export namespace planBoardPlacementFx {
	export interface Props {
		excludedLocations?: ReadonlyArray<BoardLocationSchema.Type>;
		item: ItemSchema.Type;
		origin: BoardLocationSchema.Type;
		placement: PlacementSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Resolves one board-space origin, then plans stack-first nearest placement there. */
export const planBoardPlacementFx = Effect.fn("planBoardPlacementFx")(function* ({
	excludedLocations,
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
	const boardLocations = readBoardLocationsFn({
		size: config.meta.board,
		space: origin.space,
	});
	const orderedBoardLocations = orderGridLocationsFn({
		locations: boardLocations,
		origin: placementOrigin.position,
	});

	return yield* planScopePlacementFx({
		excludedLocations,
		item,
		locations: orderedBoardLocations,
		origin: placementOrigin.position,
		quantity,
		runtime,
	});
});
