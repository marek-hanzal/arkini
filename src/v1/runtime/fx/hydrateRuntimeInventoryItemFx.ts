import { Effect } from "effect";

import type { GameSchema } from "~/v1/schema/GameSchema";
import type { RuntimeInventoryItemSchema } from "~/v1/runtime/schema/RuntimeInventoryItemSchema";
import type { StateInventoryItemSchema } from "~/v1/state/schema/StateInventoryItemSchema";
import { resolveRuntimeItemFx } from "./resolveRuntimeItemFx";

export namespace hydrateRuntimeInventoryItemFx {
	export interface Props {
		game: GameSchema.Type;
		state: StateInventoryItemSchema.Type;
	}
}

/**
 * Hydrates one persisted inventory item with its canonical item reference.
 */
export const hydrateRuntimeInventoryItemFx = Effect.fn("hydrateRuntimeInventoryItemFx")(function* ({
	game,
	state,
}: hydrateRuntimeInventoryItemFx.Props) {
	const item = yield* resolveRuntimeItemFx({
		game,
		itemId: state.itemId,
	});
	const result = {
		id: state.id,
		item,
		quantity: state.quantity,
	};

	return result satisfies RuntimeInventoryItemSchema.Type;
});
