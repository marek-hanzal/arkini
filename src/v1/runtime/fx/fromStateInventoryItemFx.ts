import { Effect } from "effect";

import type { GameSchema } from "~/v1/schema/GameSchema";
import type { RuntimeInventoryItemSchema } from "~/v1/runtime/schema/RuntimeInventoryItemSchema";
import type { StateInventoryItemSchema } from "~/v1/state/schema/StateInventoryItemSchema";
import { resolveRuntimeItemFx } from "./resolveRuntimeItemFx";

export namespace fromStateInventoryItemFx {
	export interface Props {
		game: GameSchema.Type;
		state: StateInventoryItemSchema.Type;
	}
}

/**
 * Builds one runtime inventory item from its persisted state representation.
 *
 * Counterpart: `fromRuntimeInventoryItemFx` in
 * `~/v1/state/fx/fromRuntimeInventoryItemFx` builds state from this runtime item.
 */
export const fromStateInventoryItemFx = Effect.fn("fromStateInventoryItemFx")(function* ({
	game,
	state,
}: fromStateInventoryItemFx.Props) {
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
