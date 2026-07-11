import { Effect } from "effect";

import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";
import type { StateItemSchema } from "~/v1/state/schema/StateItemSchema";

export namespace fromRuntimeItemFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
		scope: Exclude<ScopeEnumSchema.Type, "any">;
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
	scope,
}: fromRuntimeItemFx.Props) {
	const result = {
		id: item.id,
		itemId: item.item.id,
		quantity: item.quantity,
		scope,
		x: item.x,
		y: item.y,
	};

	return result satisfies StateItemSchema.Type;
});
