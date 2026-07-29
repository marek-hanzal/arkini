import { Effect } from "effect";

import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { DropResultSchema } from "~/engine/output/schema/DropResultSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { assertPlacementMaxCountFx } from "./assertPlacementMaxCountFx";
import { planDropScopePlacementFx } from "./planDropScopePlacementFx";
import type { BoardRectangleSchema } from "~/engine/grid/schema/BoardRectangleSchema";

export namespace planDropPlacementFx {
	export interface Props {
		drop: DropResultSchema.Type;
		excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
		origin: BoardLocationSchema.Type;
		originRectangle?: BoardRectangleSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Plans one complete all-or-nothing drop through its authored board strategy and scope. */
export const planDropPlacementFx = Effect.fn("planDropPlacementFx")(function* ({
	drop,
	excludedLocations,
	origin,
	originRectangle,
	runtime,
}: planDropPlacementFx.Props) {
	const item = yield* resolveItemFx({
		itemId: drop.itemId,
	});
	yield* assertPlacementMaxCountFx({
		drop,
		item,
		runtime,
	});

	return yield* planDropScopePlacementFx({
		drop,
		excludedLocations,
		item,
		origin,
		originRectangle,
		quantity: drop.quantity,
		runtime,
	});
});
