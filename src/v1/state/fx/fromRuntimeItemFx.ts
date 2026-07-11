import { Effect } from "effect";

import type { BaseRuntimeItemSchema } from "~/v1/runtime/schema/BaseRuntimeItemSchema";
import type { BaseStateItemSchema } from "~/v1/state/schema/BaseStateItemSchema";

export namespace fromRuntimeItemFx {
	export interface Props {
		item: BaseRuntimeItemSchema.Type;
	}
}

/**
 * Builds one persisted grid item from its runtime representation.
 *
 * Counterpart: `fromStateItemFx` in `~/v1/runtime/fx/fromStateItemFx` builds
 * runtime from this state item.
 */
export const fromRuntimeItemFx = Effect.fn("fromRuntimeItemFx")(function* ({
	item,
}: fromRuntimeItemFx.Props) {
	const result = {
		id: item.id,
		itemId: item.item.id,
		quantity: item.quantity,
	};

	return result satisfies BaseStateItemSchema.Type;
});
