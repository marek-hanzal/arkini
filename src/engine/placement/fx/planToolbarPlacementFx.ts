import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { planScopePlacementFx } from "./planScopePlacementFx";
import { readToolbarLocationsFx } from "./readToolbarLocationsFx";

export namespace planToolbarPlacementFx {
	export interface Props {
		item: ItemSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Plans stack-first placement in the universe-wide passive toolbar. */
export const planToolbarPlacementFx = Effect.fn("planToolbarPlacementFx")(function* ({
	item,
	quantity,
	runtime,
}: planToolbarPlacementFx.Props) {
	const config = yield* GameConfigFx;
	const locations = yield* readToolbarLocationsFx({
		size: config.meta.toolbarSize ?? 0,
	});
	return yield* planScopePlacementFx({
		item,
		locations,
		quantity,
		runtime,
	});
});
