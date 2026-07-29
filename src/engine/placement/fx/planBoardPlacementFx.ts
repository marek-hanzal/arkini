import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { orderBoardLocationsFx } from "./orderBoardLocationsFx";
import { planScopePlacementFx } from "./planScopePlacementFx";
import { readBoardLocationsFx } from "./readBoardLocationsFx";
import { resolveBoardPlacementOriginFx } from "./resolveBoardPlacementOriginFx";
import type { BoardRectangleSchema } from "~/engine/grid/schema/BoardRectangleSchema";
import { createBoardRectangleFx } from "~/engine/grid/fx/createBoardRectangleFx";
import { PlacementEnumSchema } from "~/engine/placement/schema/PlacementEnumSchema";

export namespace planBoardPlacementFx {
	export interface Props {
		excludedLocations?: ReadonlyArray<BoardLocationSchema.Type>;
		item: ItemSchema.Type;
		origin: BoardLocationSchema.Type;
		originRectangle?: BoardRectangleSchema.Type;
		placement: PlacementEnumSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Resolves one board-space origin, then plans stack-first nearest placement there. */
export const planBoardPlacementFx = Effect.fn("planBoardPlacementFx")(function* ({
	excludedLocations,
	item,
	origin,
	originRectangle,
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
	const placementOriginRectangle =
		placement === PlacementEnumSchema.enum.Drop && originRectangle !== undefined
			? originRectangle
			: yield* createBoardRectangleFx({
					anchor: placementOrigin,
					footprint: {
						width: 1,
						height: 1,
					},
				});
	const orderedBoardLocations = yield* orderBoardLocationsFx({
		item,
		locations: boardLocations,
		origin: placementOriginRectangle,
	});

	return yield* planScopePlacementFx({
		excludedLocations,
		item,
		locations: orderedBoardLocations,
		origin: placementOriginRectangle,
		quantity,
		runtime,
	});
});
