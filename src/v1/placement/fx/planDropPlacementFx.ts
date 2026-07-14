import { Effect } from "effect";

import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import { resolveItemFx } from "~/v1/item/fx/resolveItemFx";
import type { DropResultSchema } from "~/v1/output/schema/DropResultSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { assertPlacementMaxCountFx } from "./assertPlacementMaxCountFx";
import { planDropScopePlacementFx } from "./planDropScopePlacementFx";

export namespace planDropPlacementFx {
	export interface Props {
		drop: DropResultSchema.Type;
		origin: PositionSchema.Type;
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
