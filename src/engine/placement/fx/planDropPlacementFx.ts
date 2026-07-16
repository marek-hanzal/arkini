import { Effect } from "effect";

import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import type { DropResultSchema } from "~/engine/output/schema/DropResultSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { assertPlacementMaxCountFx } from "./assertPlacementMaxCountFx";
import { planDropScopePlacementFx } from "./planDropScopePlacementFx";

export namespace planDropPlacementFx {
	export interface Props {
		drop: DropResultSchema.Type;
		origin: BoardLocationSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Plans one complete all-or-nothing drop through its authored board strategy and scope. */
export const planDropPlacementFx = Effect.fn("planDropPlacementFx")(function* ({
	drop,
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
		item,
		origin,
		quantity: drop.quantity,
		runtime,
	});
});
