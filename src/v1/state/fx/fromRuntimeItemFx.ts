import { Effect } from "effect";

import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { StateItemSchema } from "~/v1/state/schema/StateItemSchema";

export namespace fromRuntimeItemFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
	}
}

/**
 * Builds one persisted gameplay item without the runtime-only revision token.
 *
 * Counterpart: `fromStateItemFx` in `~/v1/runtime/fx/fromStateItemFx` builds
 * runtime from this state item.
 */
export const fromRuntimeItemFx = Effect.fn("fromRuntimeItemFx")(function* ({
	item,
}: fromRuntimeItemFx.Props) {
	return {
		id: item.id,
		itemId: item.item.id,
		location: item.location,
		quantity: item.quantity,
		remainingCharges: item.remainingCharges,
	} satisfies StateItemSchema.Type;
});
