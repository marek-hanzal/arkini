import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { BoardLocationSchema } from "~/v1/location/schema/BoardLocationSchema";
import type { PlacementEnumSchema } from "~/v1/placement/schema/PlacementEnumSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
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
