import { Effect } from "effect";

import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { placeRuntimeItemFx } from "~/engine/placement/fx/placeRuntimeItemFx";
import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Returns selected buffered roots through canonical placement and aggregates their result. */
export const returnBufferedLineItemsFx = Effect.fn("returnBufferedLineItemsFx")(function* ({
	items,
	owner,
	runtime,
}: {
	readonly items: readonly RuntimeItemSchema.Type[];
	readonly owner: BoardRuntimeItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	let draft = runtime;
	const events: GameEventSchema.Type[] = [];
	for (const item of items) {
		const placement = yield* placeRuntimeItemFx({
			itemId: item.id,
			origin: owner.location,
			originItemId: owner.id,
			runtime: draft,
		});
		events.push(...placement.events);
		draft = placement.runtime;
	}
	return {
		events,
		runtime: draft,
		withdrawnItemCount: items.length,
		withdrawnQuantity: items.reduce((total, item) => total + item.quantity, 0),
	};
});
