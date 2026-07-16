import { Effect } from "effect";

import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { StateItemSchema } from "~/engine/state/schema/StateItemSchema";

export namespace fromRuntimeItemFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
	}
}

/**
 * Builds one persisted gameplay item without the runtime-only revision token.
 *
 * Counterpart: `fromStateItemFx` in `~/engine/runtime/fx/fromStateItemFx` builds
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
		remainingDurationMs: item.remainingDurationMs,
	} satisfies StateItemSchema.Type;
});
