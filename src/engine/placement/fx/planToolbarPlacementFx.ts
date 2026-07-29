import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { planScopePlacementFx } from "./planScopePlacementFx";
import { readToolbarLocationsFx } from "./readToolbarLocationsFx";

export namespace planToolbarPlacementFx {
	export interface Props {
		excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
		item: ItemSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Plans stack-first placement in the universe-wide passive toolbar. */
export const planToolbarPlacementFx = Effect.fn("planToolbarPlacementFx")(function* ({
	excludedLocations,
	item,
	quantity,
	runtime,
}: planToolbarPlacementFx.Props) {
	const config = yield* GameConfigFx;
	const locations = yield* readToolbarLocationsFx({
		size: config.meta.toolbarSize ?? 0,
	});
	return yield* planScopePlacementFx({
		excludedLocations,
		item,
		locations,
		quantity,
		runtime,
	});
});
