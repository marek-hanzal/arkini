import { Effect } from "effect";

import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { dropFx } from "~/production-output/fx/dropFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { assertPlacementMaxCountFx } from "./assertPlacementMaxCountFx";
import { planDropScopePlacementFx } from "./planDropScopePlacementFx";

export namespace planDropPlacementFx {
	export interface Props {
		drop: dropFx.Result;
		excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
		origin: GridLocationSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Plans one complete all-or-nothing drop through its authored board strategy and scope. */
export const planDropPlacementFx = Effect.fn("planDropPlacementFx")(function* ({
	drop,
	excludedLocations,
	origin,
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
		quantity: drop.quantity,
		runtime,
	});
});
